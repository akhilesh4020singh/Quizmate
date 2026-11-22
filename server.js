const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

// Firebase Admin SDK Setup
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (!serviceAccountPath) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH is missing in .env");
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
    credential: admin.cert(serviceAccount)
});

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "quizmate",
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10
});

// Helpers
async function getUser(id) {
    const [rows] = await db.query(
        "SELECT id, name, email, role FROM students WHERE id = ?",
        [id]
    );
    return rows[0] || null;
}

async function isAdmin(id) {
    const user = await getUser(id);
    return user && user.role.toLowerCase() === "admin";
}

// Server Test
app.get("/", (req, res) => {
    res.send("QuizMate Backend is Running!");
});

// Database Test
app.get("/test-db", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, name, email, role FROM students"
        );
        res.json({
            message: "MySQL Connected Successfully!",
            students: rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Database Connection Failed" });
    }
});

// Register
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                message: "Please fill all fields."
            });
        }

        const userRole = role.toLowerCase();

        if (!["student", "teacher"].includes(userRole)) {
            return res.status(403).json({
                message: "Invalid registration role."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO students (name, email, password, role)
             VALUES (?, ?, ?, ?)`,
            [
                name.trim(),
                email.trim().toLowerCase(),
                hashedPassword,
                userRole
            ]
        );

        res.status(201).json({
            message: "Account created successfully!"
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "This email is already registered."
            });
        }

        console.error(error);
        res.status(500).json({ message: "Registration failed." });
    }
});

// Login
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Please enter email and password."
            });
        }

        const [rows] = await db.query(
            "SELECT * FROM students WHERE email = ?",
            [email.trim().toLowerCase()]
        );

        if (!rows.length) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = rows[0];

        const matched = await bcrypt.compare(
            password,
            user.password
        );

        if (!matched) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        res.json({
            message: "Login successful!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role.charAt(0).toUpperCase() +
                      user.role.slice(1).toLowerCase()
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Login failed." });
    }
});

// Google Login with Firebase
app.post("/api/google-login", async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({
                message: "Google ID token is required."
            });
        }

        // Verify Firebase ID Token
        const decodedToken = await getAuth().verifyIdToken(idToken);

        if (!decodedToken.email || !decodedToken.email_verified) {
            return res.status(401).json({
                message: "Please use a verified Google account."
            });
        }

        const email = decodedToken.email.trim().toLowerCase();
        const name = decodedToken.name || email.split("@")[0];

        // Check existing MySQL account
        const [rows] = await db.query(
            "SELECT id, name, email, role FROM students WHERE email = ?",
            [email]
        );

        let user;

        if (rows.length > 0) {
            // Keep existing account and role
            user = rows[0];

        } else {
            // Create new Google user as Student
            const randomPassword = crypto.randomBytes(32).toString("hex");
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            const [result] = await db.query(
                `INSERT INTO students (name, email, password, role)
                 VALUES (?, ?, ?, ?)`,
                [name.trim(), email, hashedPassword, "student"]
            );

            user = {
                id: result.insertId,
                name: name.trim(),
                email,
                role: "student"
            };
        }

        res.json({
            message: "Google login successful!",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role.charAt(0).toUpperCase() +
                      user.role.slice(1).toLowerCase()
            }
        });

    } catch (error) {
        console.error("Google Login Error:", error);

        if (
            error.code === "auth/argument-error" ||
            error.code === "auth/id-token-expired" ||
            error.code === "auth/id-token-revoked" ||
            error.code === "auth/invalid-id-token"
        ) {
            return res.status(401).json({
                message: "Google authentication failed. Please try again."
            });
        }

        res.status(500).json({
            message: "Google login failed."
        });
    }
});

// Create Quiz
app.post("/api/quizzes", async (req, res) => {
    try {
        const {
            title,
            subject,
            description,
            duration,
            questions,
            created_by
        } = req.body;

        if (
            !title || !subject ||
            !Number.isInteger(Number(duration)) ||
            Number(duration) < 1 ||
            !Array.isArray(questions) ||
            questions.length === 0 ||
            !created_by
        ) {
            return res.status(400).json({
                message: "Please enter valid quiz details."
            });
        }

        const user = await getUser(created_by);

        if (
            !user ||
            !["teacher", "admin"].includes(user.role.toLowerCase())
        ) {
            return res.status(403).json({
                message: "Only Teacher or Admin can create quizzes."
            });
        }

        const quizId = Date.now();

        await db.query(
            `INSERT INTO quizzes
             (id, title, subject, description, duration, questions, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                quizId,
                title.trim(),
                subject.trim(),
                description || "",
                Number(duration),
                JSON.stringify(questions),
                created_by
            ]
        );

        res.status(201).json({
            message: "Quiz created successfully!",
            quizId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Quiz creation failed." });
    }
});

// Get All Quizzes
app.get("/api/quizzes", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT * FROM quizzes ORDER BY created_at DESC"
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to fetch quizzes."
        });
    }
});

// Edit Quiz
app.put("/api/quizzes/:id", async (req, res) => {
    try {
        const quizId = req.params.id;

        const {
            user_id,
            title,
            subject,
            description,
            duration,
            questions
        } = req.body;

        if (
            !user_id ||
            !title || !title.trim() ||
            !subject || !subject.trim() ||
            typeof description !== "string" ||
            !Number.isInteger(Number(duration)) ||
            Number(duration) < 1 ||
            Number(duration) > 180 ||
            !Array.isArray(questions) ||
            questions.length < 1 ||
            questions.length > 10
        ) {
            return res.status(400).json({
                message: "Please enter valid quiz details."
            });
        }

        const validQuestions = questions.every(question =>
            question &&
            typeof question.q === "string" &&
            question.q.trim() &&
            Array.isArray(question.options) &&
            question.options.length === 4 &&
            question.options.every(option =>
                typeof option === "string" && option.trim()
            ) &&
            Number.isInteger(question.answer) &&
            question.answer >= 0 &&
            question.answer <= 3
        );

        if (!validQuestions) {
            return res.status(400).json({
                message: "Each question must have 4 options and one correct answer."
            });
        }

        const user = await getUser(user_id);

        if (
            !user ||
            !["teacher", "admin"].includes(user.role.toLowerCase())
        ) {
            return res.status(403).json({
                message: "Only Teacher or Admin can edit quizzes."
            });
        }

        const [quizzes] = await db.query(
            "SELECT id, created_by FROM quizzes WHERE id = ?",
            [quizId]
        );

        if (!quizzes.length) {
            return res.status(404).json({
                message: "Quiz not found in database."
            });
        }

        const isUserAdmin = user.role.toLowerCase() === "admin";
        const isOwner =
            Number(quizzes[0].created_by) === Number(user.id);

        if (!isUserAdmin && !isOwner) {
            return res.status(403).json({
                message: "You can only edit quizzes created by you."
            });
        }

        await db.query(
            `UPDATE quizzes
             SET title = ?,
                 subject = ?,
                 description = ?,
                 duration = ?,
                 questions = ?
             WHERE id = ?`,
            [
                title.trim(),
                subject.trim(),
                description.trim(),
                Number(duration),
                JSON.stringify(
                    questions.map(question => ({
                        q: question.q.trim(),
                        options: question.options.map(option => option.trim()),
                        answer: question.answer
                    }))
                ),
                quizId
            ]
        );

        res.json({
            message: "Quiz updated successfully!"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Quiz update failed."
        });
    }
});

// Delete Quiz
app.delete("/api/quizzes/:id", async (req, res) => {
    try {
        const quizId = req.params.id;
        const userId = req.query.user_id;

        const user = await getUser(userId);

        if (!user) {
            return res.status(401).json({
                message: "Please login first."
            });
        }

        const [quizzes] = await db.query(
            "SELECT id, created_by FROM quizzes WHERE id = ?",
            [quizId]
        );

        if (!quizzes.length) {
            return res.status(404).json({
                message: "Quiz not found."
            });
        }

        const isUserAdmin = user.role.toLowerCase() === "admin";
        const isOwner =
            Number(quizzes[0].created_by) === Number(user.id);

        if (!isUserAdmin && !isOwner) {
            return res.status(403).json({
                message: "You cannot delete this quiz."
            });
        }

        await db.query(
            "DELETE FROM quizzes WHERE id = ?",
            [quizId]
        );

        res.json({ message: "Quiz deleted successfully!" });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Quiz deletion failed."
        });
    }
});

// Save Quiz Result
app.post("/api/results", async (req, res) => {
    try {
        const {
            student_id,
            quiz_id,
            score,
            total_questions,
            correct_answers
        } = req.body;

        if (
            !student_id || !quiz_id ||
            score === undefined ||
            !total_questions ||
            correct_answers === undefined ||
            Number(score) < 0 ||
            Number(score) > 100 ||
            Number(correct_answers) < 0 ||
            Number(correct_answers) > Number(total_questions)
        ) {
            return res.status(400).json({
                message: "Invalid result details."
            });
        }

        const [students] = await db.query(
            "SELECT id, role FROM students WHERE id = ?",
            [student_id]
        );

        if (
            !students.length ||
            students[0].role.toLowerCase() !== "student"
        ) {
            return res.status(404).json({
                message: "Student not found."
            });
        }

        const [quizzes] = await db.query(
            "SELECT id FROM quizzes WHERE id = ?",
            [quiz_id]
        );

        if (!quizzes.length) {
            return res.status(404).json({
                message: "Quiz not found."
            });
        }

        await db.query(
            `INSERT INTO results
             (student_id, quiz_id, score, total_questions, correct_answers)
             VALUES (?, ?, ?, ?, ?)`,
            [
                student_id,
                quiz_id,
                score,
                total_questions,
                correct_answers
            ]
        );

        res.status(201).json({
            message: "Result saved successfully!"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to save result."
        });
    }
});

// Student Result History
app.get("/api/results/:studentId", async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT
                r.id,
                r.student_id,
                r.quiz_id,
                r.score,
                r.total_questions,
                r.correct_answers,
                r.attempted_at,
                q.title AS quiz_title,
                q.subject
             FROM results r
             INNER JOIN quizzes q ON r.quiz_id = q.id
             WHERE r.student_id = ?
             ORDER BY r.attempted_at DESC`,
            [req.params.studentId]
        );

        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to load result history."
        });
    }
});

// MySQL Leaderboard
app.get("/api/leaderboard", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT
                s.id AS student_id,
                s.name AS student_name,
                ROUND(AVG(r.score), 2) AS average_score,
                COUNT(r.id) AS total_attempts
             FROM results r
             INNER JOIN students s ON r.student_id = s.id
             WHERE s.role = 'student'
             GROUP BY s.id, s.name
             ORDER BY average_score DESC, total_attempts DESC
             LIMIT 10`
        );

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to load leaderboard."
        });
    }
});

// Dashboard Statistics
app.get("/api/dashboard/:userId", async (req, res) => {
    try {
        const user = await getUser(req.params.userId);

        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        const role = user.role.toLowerCase();

        if (role === "student") {
            const [[stats]] = await db.query(
                `SELECT
                    COUNT(*) AS attempts,
                    ROUND(AVG(score), 2) AS average_score
                 FROM results
                 WHERE student_id = ?`,
                [user.id]
            );

            const [[quizStats]] = await db.query(
                "SELECT COUNT(*) AS total_quizzes FROM quizzes"
            );

            return res.json({
                role,
                attempts: stats.attempts || 0,
                average_score: stats.average_score || 0,
                total_quizzes: quizStats.total_quizzes || 0
            });
        }

        const [[quizStats]] = await db.query(
            role === "admin"
                ? "SELECT COUNT(*) AS total FROM quizzes"
                : "SELECT COUNT(*) AS total FROM quizzes WHERE created_by = ?",
            role === "admin" ? [] : [user.id]
        );

        const [[attemptStats]] = await db.query(
            role === "admin"
                ? "SELECT COUNT(*) AS total FROM results"
                : `SELECT COUNT(*) AS total
                   FROM results r
                   INNER JOIN quizzes q ON r.quiz_id = q.id
                   WHERE q.created_by = ?`,
            role === "admin" ? [] : [user.id]
        );

        if (role === "admin") {
            const [[studentStats]] = await db.query(
                "SELECT COUNT(*) AS total FROM students WHERE role = 'student'"
            );

            const [[teacherStats]] = await db.query(
                "SELECT COUNT(*) AS total FROM students WHERE role = 'teacher'"
            );

            return res.json({
                role,
                total_quizzes: quizStats.total,
                total_attempts: attemptStats.total,
                total_students: studentStats.total,
                total_teachers: teacherStats.total
            });
        }

        res.json({
            role,
            total_quizzes: quizStats.total,
            total_attempts: attemptStats.total
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to load dashboard statistics."
        });
    }
});

// Teacher Recent Attempts
app.get("/api/teacher-attempts/:userId", async (req, res) => {
    try {
        const user = await getUser(req.params.userId);

        if (!user || user.role.toLowerCase() !== "teacher") {
            return res.status(403).json({
                message: "Teacher access required."
            });
        }

        const [rows] = await db.query(
            `SELECT
                s.name AS student_name,
                q.title AS quiz_title,
                r.score,
                r.attempted_at
             FROM results r
             INNER JOIN students s ON r.student_id = s.id
             INNER JOIN quizzes q ON r.quiz_id = q.id
             WHERE q.created_by = ?
             ORDER BY r.attempted_at DESC
             LIMIT 8`,
            [user.id]
        );

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to load attempts."
        });
    }
});

// Admin: Clear All Results
app.delete("/api/admin/results", async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!(await isAdmin(user_id))) {
            return res.status(403).json({
                message: "Admin access required."
            });
        }

        await db.query("DELETE FROM results");

        res.json({
            message: "All results deleted successfully."
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to clear results."
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`QuizMate Server running at http://localhost:${PORT}`);
});