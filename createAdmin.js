// createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Define Student Schema (same as in server.js)
const studentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    batch: { type: String, required: true },
    courseName: { type: String, required: true },
    enrollmentDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'At Risk', 'Completed', 'Dropped'], default: 'Active' },
    role: { type: String, enum: ['admin', 'student'], default: 'student' }
});

// Create Student Model
const Student = mongoose.model('Student', studentSchema);

// Create admin user
async function createAdminUser() {
    try {
        // Check if admin already exists
        const existingAdmin = await Student.findOne({ studentId: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash('0907753990', 10);

        // Create admin user
        const admin = new Student({
            studentId: 'ahmed',
            password: hashedPassword,
            fullName: 'System Administrator',
            batch: 'ADMIN',
            courseName: 'System Administration',
            role: 'admin'
        });

        // Save admin user
        await admin.save();
        console.log('Admin user created successfully');
        
        // Close connection
        mongoose.connection.close();
    } catch (error) {
        console.error('Error creating admin user:', error);
        mongoose.connection.close();
    }
}

// Run the function
createAdminUser();