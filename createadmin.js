const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function createAdmin() {
    let db;

    try {
        db = await mysql.createConnection({
            host: "localhost",
            user: "root",
            password: process.env.DB_PASSWORD,
            database: "quizmate",
            port: 3306
        });

        const [existing] = await db.query(
            "SELECT id FROM students WHERE role = 'admin'"
        );

        if (existing.length > 0) {
            console.log("Admin account already exists!");
            return;
        }

        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            throw new Error("Admin details missing in .env file.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO students (name, email, password, role) VALUES (?, ?, ?, ?)",
            ["Main Admin", email, hashedPassword, "admin"]
        );

        console.log("Main Admin account created successfully!");
        console.log("Admin Email:", email);

    } catch (error) {
        console.log("Error:", error.message);
    } finally {
        if (db) await db.end();
    }
}

createAdmin();