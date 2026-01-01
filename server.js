// server.js (updated version - fixing delete routes)

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Define Schemas
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

const courseSchema = new mongoose.Schema({
    name: { type: String, required: true },
    totalLessons: { type: Number, required: true },
    duration: { type: String, required: true },
    batch: { type: String, required: true }
});

const attendanceSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    date: { type: Date, required: true },
    course: { type: String, required: true },
    classType: { type: String, enum: ['Lecture', 'Quiz'], required: true },
    status: { type: String, enum: ['Present', 'Absent'], required: true }
});

const quizSchema = new mongoose.Schema({
    quizId: { type: String, required: true },
    date: { type: Date, required: true },
    topic: { type: String, required: true },
    course: { type: String, required: true },
    studentId: { type: String, required: true },
    participation: { type: String, enum: ['Taken', 'Missed'], required: true },
    score: { type: Number },
    passFail: { type: String, enum: ['Pass', 'Fail'] }
});

const progressSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    course: { type: String, required: true },
    totalLessons: { type: Number, required: true },
    lessonsCompleted: { type: Number, default: 0 },
    completionPercentage: { type: Number, default: 0 },
    currentLesson: { type: Number, default: 1 },
    lastActivityDate: { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    projectName: { type: String, required: true },
    course: { type: String, required: true },
    submissionStatus: { type: String, enum: ['Submitted', 'Missing'], required: true },
    reviewStatus: { type: String, enum: ['Approved', 'Not Approved'], default: 'Not Approved' },
    score: { type: Number }
});

const paymentSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    status: { type: String, enum: ['Free', 'Paid', 'Partial'], required: true },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentDate: { type: Date }
});

const certificateSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    status: { type: String, enum: ['Eligible', 'Not Eligible'], required: true },
    requested: { type: Boolean, default: false },
    created: { type: Boolean, default: false }
});

// Create Models
const Student = mongoose.model('Student', studentSchema);
const Course = mongoose.model('Course', courseSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Quiz = mongoose.model('Quiz', quizSchema);
const Progress = mongoose.model('Progress', progressSchema);
const Project = mongoose.model('Project', projectSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Certificate = mongoose.model('Certificate', certificateSchema);

// Authentication Middleware
const authenticate = (req, res, next) => {
    const { studentId, password } = req.body;
    
    if (!studentId || !password) {
        return res.status(401).json({ message: 'Student ID and password are required' });
    }
    
    Student.findOne({ studentId })
        .then(student => {
            if (!student) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            
            bcrypt.compare(password, student.password, (err, result) => {
                if (err || !result) {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }
                req.user = student;
                next();
            });
        })
        .catch(err => {
            if (!res.headersSent) {
                res.status(500).json({ message: 'Server error' });
            }
        });
};

// Admin Middleware
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }
    next();
};

// API Routes

// Login
app.post('/api/login', authenticate, (req, res) => {
    if (res.headersSent) return;
    res.json({
        message: 'Login successful',
        user: {
            studentId: req.user.studentId,
            fullName: req.user.fullName,
            role: req.user.role
        }
    });
});

// Student Routes
app.get('/api/students', (req, res) => {
    if (res.headersSent) return;
    Student.find()
        .then(students => {
            if (!res.headersSent) res.json(students);
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

app.get('/api/students/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Try to find by _id first, then by studentId
    Student.findById(req.params.id)
        .then(student => {
            if (student) {
                if (!res.headersSent) return res.json(student);
            }
            // If not found by _id, try by studentId
            return Student.findOne({ studentId: req.params.id });
        })
        .then(student => {
            if (!res.headersSent) {
                if (!student) {
                    return res.status(404).json({ message: 'Student not found' });
                }
                res.json(student);
            }
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

app.post('/api/students', (req, res) => {
    if (res.headersSent) return;
    
    const { studentId, password, fullName, batch, courseName, role } = req.body;
    
    // Hash password
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            if (!res.headersSent) return res.status(500).json({ message: 'Server error' });
        }
        
        const newStudent = new Student({
            studentId,
            password: hashedPassword,
            fullName,
            batch,
            courseName,
            role: role || 'student'
        });
        
        newStudent.save()
            .then(student => {
                // Initialize related records
                new Progress({
                    studentId: student.studentId,
                    course: student.courseName,
                    totalLessons: 10 // Default value, should be updated based on course
                }).save();
                
                new Payment({
                    studentId: student.studentId,
                    status: 'Free'
                }).save();
                
                new Certificate({
                    studentId: student.studentId,
                    status: 'Not Eligible'
                }).save();
                
                if (!res.headersSent) res.status(201).json(student);
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error creating student', error: err.message });
            });
    });
});

app.put('/api/students/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Try to update by _id first, then by studentId
    Student.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .then(student => {
            if (student) {
                if (!res.headersSent) return res.json(student);
            }
            // If not updated by _id, try by studentId
            return Student.findOneAndUpdate({ studentId: req.params.id }, req.body, { new: true });
        })
        .then(student => {
            if (!res.headersSent) {
                if (!student) {
                    return res.status(404).json({ message: 'Student not found' });
                }
                res.json(student);
            }
        })
        .catch(err => {
            if (!res.headersSent) res.status(400).json({ message: 'Error updating student', error: err.message });
        });
});

// Fixed delete route for students
app.delete('/api/students/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, delete by _id
        Student.findByIdAndDelete(req.params.id)
            .then(student => {
                if (!res.headersSent) {
                    if (!student) {
                        return res.status(404).json({ message: 'Student not found' });
                    }
                    
                    // Delete related records
                    Progress.deleteMany({ studentId: student.studentId }).exec();
                    Payment.deleteMany({ studentId: student.studentId }).exec();
                    Certificate.deleteMany({ studentId: student.studentId }).exec();
                    
                    res.json({ message: 'Student deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to delete by studentId
        Student.findOneAndDelete({ studentId: req.params.id })
            .then(student => {
                if (!res.headersSent) {
                    if (!student) {
                        return res.status(404).json({ message: 'Student not found' });
                    }
                    
                    // Delete related records
                    Progress.deleteMany({ studentId: student.studentId }).exec();
                    Payment.deleteMany({ studentId: student.studentId }).exec();
                    Certificate.deleteMany({ studentId: student.studentId }).exec();
                    
                    res.json({ message: 'Student deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

// Course Routes
app.get('/api/courses', (req, res) => {
    if (res.headersSent) return;
    Course.find()
        .then(courses => {
            if (!res.headersSent) res.json(courses);
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

app.get('/api/courses/:id', (req, res) => {
    if (res.headersSent) return;
    Course.findById(req.params.id)
        .then(course => {
            if (!res.headersSent) {
                if (!course) {
                    return res.status(404).json({ message: 'Course not found' });
                }
                res.json(course);
            }
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

app.post('/api/courses', (req, res) => {
    if (res.headersSent) return;
    const newCourse = new Course(req.body);
    newCourse.save()
        .then(course => {
            if (!res.headersSent) res.status(201).json(course);
        })
        .catch(err => {
            if (!res.headersSent) res.status(400).json({ message: 'Error creating course', error: err.message });
        });
});

app.put('/api/courses/:id', (req, res) => {
    if (res.headersSent) return;
    Course.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .then(course => {
            if (!res.headersSent) {
                if (!course) {
                    return res.status(404).json({ message: 'Course not found' });
                }
                res.json(course);
            }
        })
        .catch(err => {
            if (!res.headersSent) res.status(400).json({ message: 'Error updating course', error: err.message });
        });
});

// Fixed delete route for courses
app.delete('/api/courses/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, delete by _id
        Course.findByIdAndDelete(req.params.id)
            .then(course => {
                if (!res.headersSent) {
                    if (!course) {
                        return res.status(404).json({ message: 'Course not found' });
                    }
                    res.json({ message: 'Course deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to delete by some other field
        Course.findOneAndDelete({ name: req.params.id })
            .then(course => {
                if (!res.headersSent) {
                    if (!course) {
                        return res.status(404).json({ message: 'Course not found' });
                    }
                    res.json({ message: 'Course deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

// Attendance Routes
app.get('/api/attendance/:studentId', (req, res) => {
    if (res.headersSent) return;
    Attendance.find({ studentId: req.params.studentId })
        .then(attendance => {
            if (!res.headersSent) res.json(attendance);
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

// Updated to handle both _id and attendanceId
app.get('/api/attendance/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, find by _id
        Attendance.findById(req.params.id)
            .then(attendance => {
                if (!res.headersSent) {
                    if (!attendance) {
                        return res.status(404).json({ message: 'Attendance record not found' });
                    }
                    res.json(attendance);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to find by some other field
        Attendance.findOne({ attendanceId: req.params.id })
            .then(attendance => {
                if (!res.headersSent) {
                    if (!attendance) {
                        return res.status(404).json({ message: 'Attendance record not found' });
                    }
                    res.json(attendance);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

app.post('/api/attendance', (req, res) => {
    if (res.headersSent) return;
    const newAttendance = new Attendance(req.body);
    newAttendance.save()
        .then(attendance => {
            if (!res.headersSent) res.status(201).json(attendance);
        })
        .catch(err => {
            if (!res.headersSent) res.status(400).json({ message: 'Error recording attendance', error: err.message });
        });
});

app.put('/api/attendance/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, update by _id
        Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .then(attendance => {
                if (!res.headersSent) {
                    if (!attendance) {
                        return res.status(404).json({ message: 'Attendance record not found' });
                    }
                    res.json(attendance);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating attendance', error: err.message });
            });
    } else {
        // If not an ObjectId, try to update by some other field
        Attendance.findOneAndUpdate({ attendanceId: req.params.id }, req.body, { new: true })
            .then(attendance => {
                if (!res.headersSent) {
                    if (!attendance) {
                        return res.status(404).json({ message: 'Attendance record not found' });
                    }
                    res.json(attendance);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating attendance', error: err.message });
            });
    }
});

// Fixed delete route for attendance
app.delete('/api/attendance/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, delete by _id
        Attendance.findByIdAndDelete(req.params.id)
            .then(attendance => {
                if (!res.headersSent) {
                    if (!attendance) {
                        return res.status(404).json({ message: 'Attendance record not found' });
                    }
                    res.json({ message: 'Attendance record deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to delete by some other field
        Attendance.findOneAndDelete({ attendanceId: req.params.id })
            .then(attendance => {
                if (!res.headersSent) {
                    if (!attendance) {
                        return res.status(404).json({ message: 'Attendance record not found' });
                    }
                    res.json({ message: 'Attendance record deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

// Quiz Routes
app.get('/api/quizzes/:studentId', (req, res) => {
    if (res.headersSent) return;
    Quiz.find({ studentId: req.params.studentId })
        .then(quizzes => {
            if (!res.headersSent) res.json(quizzes);
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

// Updated to handle both _id and quizId
app.get('/api/quizzes/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, find by _id
        Quiz.findById(req.params.id)
            .then(quiz => {
                if (!res.headersSent) {
                    if (!quiz) {
                        return res.status(404).json({ message: 'Quiz not found' });
                    }
                    res.json(quiz);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to find by quizId
        Quiz.findOne({ quizId: req.params.id })
            .then(quiz => {
                if (!res.headersSent) {
                    if (!quiz) {
                        return res.status(404).json({ message: 'Quiz not found' });
                    }
                    res.json(quiz);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

app.post('/api/quizzes', (req, res) => {
    if (res.headersSent) return;
    const newQuiz = new Quiz(req.body);
    newQuiz.save()
        .then(quiz => {
            if (!res.headersSent) res.status(201).json(quiz);
        })
        .catch(err => {
            if (!res.headersSent) res.status(400).json({ message: 'Error creating quiz', error: err.message });
        });
});

app.put('/api/quizzes/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, update by _id
        Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .then(quiz => {
                if (!res.headersSent) {
                    if (!quiz) {
                        return res.status(404).json({ message: 'Quiz not found' });
                    }
                    res.json(quiz);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating quiz', error: err.message });
            });
    } else {
        // If not an ObjectId, try to update by quizId
        Quiz.findOneAndUpdate({ quizId: req.params.id }, req.body, { new: true })
            .then(quiz => {
                if (!res.headersSent) {
                    if (!quiz) {
                        return res.status(404).json({ message: 'Quiz not found' });
                    }
                    res.json(quiz);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating quiz', error: err.message });
            });
    }
});

// Fixed delete route for quizzes
app.delete('/api/quizzes/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, delete by _id
        Quiz.findByIdAndDelete(req.params.id)
            .then(quiz => {
                if (!res.headersSent) {
                    if (!quiz) {
                        return res.status(404).json({ message: 'Quiz not found' });
                    }
                    res.json({ message: 'Quiz deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to delete by quizId
        Quiz.findOneAndDelete({ quizId: req.params.id })
            .then(quiz => {
                if (!res.headersSent) {
                    if (!quiz) {
                        return res.status(404).json({ message: 'Quiz not found' });
                    }
                    res.json({ message: 'Quiz deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

// Progress Routes
app.get('/api/progress/:studentId', (req, res) => {
    if (res.headersSent) return;
    Progress.find({ studentId: req.params.studentId })
        .then(progress => {
            if (!res.headersSent) res.json(progress);
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

app.put('/api/progress/:id', (req, res) => {
    if (res.headersSent) return;
    Progress.findByIdAndUpdate(req.params.id, req.body, { new: true })
        .then(progress => {
            if (!res.headersSent) {
                if (!progress) {
                    return res.status(404).json({ message: 'Progress not found' });
                }
                res.json(progress);
            }
        })
        .catch(err => {
            if (!res.headersSent) res.status(400).json({ message: 'Error updating progress', error: err.message });
        });
});

// Project Routes
app.get('/api/projects/:studentId', (req, res) => {
    if (res.headersSent) return;
    Project.find({ studentId: req.params.studentId })
        .then(projects => {
            if (!res.headersSent) res.json(projects);
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

// Updated to handle both _id and projectId
app.get('/api/projects/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, find by _id
        Project.findById(req.params.id)
            .then(project => {
                if (!res.headersSent) {
                    if (!project) {
                        return res.status(404).json({ message: 'Project not found' });
                    }
                    res.json(project);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to find by some other field
        Project.findOne({ projectId: req.params.id })
            .then(project => {
                if (!res.headersSent) {
                    if (!project) {
                        return res.status(404).json({ message: 'Project not found' });
                    }
                    res.json(project);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

app.post('/api/projects', (req, res) => {
    if (res.headersSent) return;
    const newProject = new Project(req.body);
    newProject.save()
        .then(project => {
            if (!res.headersSent) res.status(201).json(project);
        })
        .catch(err => {
            if (!res.headersSent) res.status(400).json({ message: 'Error creating project', error: err.message });
        });
});

app.put('/api/projects/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, update by _id
        Project.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .then(project => {
                if (!res.headersSent) {
                    if (!project) {
                        return res.status(404).json({ message: 'Project not found' });
                    }
                    res.json(project);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating project', error: err.message });
            });
    } else {
        // If not an ObjectId, try to update by some other field
        Project.findOneAndUpdate({ projectId: req.params.id }, req.body, { new: true })
            .then(project => {
                if (!res.headersSent) {
                    if (!project) {
                        return res.status(404).json({ message: 'Project not found' });
                    }
                    res.json(project);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating project', error: err.message });
            });
    }
});

// Fixed delete route for projects
app.delete('/api/projects/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, delete by _id
        Project.findByIdAndDelete(req.params.id)
            .then(project => {
                if (!res.headersSent) {
                    if (!project) {
                        return res.status(404).json({ message: 'Project not found' });
                    }
                    res.json({ message: 'Project deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to delete by some other field
        Project.findOneAndDelete({ projectId: req.params.id })
            .then(project => {
                if (!res.headersSent) {
                    if (!project) {
                        return res.status(404).json({ message: 'Project not found' });
                    }
                    res.json({ message: 'Project deleted successfully' });
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

// Payment Routes
app.get('/api/payments/:studentId', (req, res) => {
    if (res.headersSent) return;
    Payment.find({ studentId: req.params.studentId })
        .then(payments => {
            if (!res.headersSent) res.json(payments);
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

// Updated to handle both _id and paymentId
app.get('/api/payments/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, find by _id
        Payment.findById(req.params.id)
            .then(payment => {
                if (!res.headersSent) {
                    if (!payment) {
                        return res.status(404).json({ message: 'Payment not found' });
                    }
                    res.json(payment);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to find by some other field
        Payment.findOne({ paymentId: req.params.id })
            .then(payment => {
                if (!res.headersSent) {
                    if (!payment) {
                        return res.status(404).json({ message: 'Payment not found' });
                    }
                    res.json(payment);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

app.post('/api/payments', (req, res) => {
    if (res.headersSent) return;
    console.log('POST /api/payments request received:', req.body);
    try {
        const newPayment = new Payment(req.body);
        newPayment.save()
            .then(payment => {
                console.log('Payment saved successfully:', payment);
                if (!res.headersSent) res.status(201).json(payment);
            })
            .catch(err => {
                console.error('Error saving payment:', err);
                if (!res.headersSent) res.status(400).json({ message: 'Error creating payment', error: err.message });
            });
    } catch (error) {
        console.error('Unexpected error in POST /api/payments:', error);
        if (!res.headersSent) res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/payments/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, update by _id
        Payment.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .then(payment => {
                if (!res.headersSent) {
                    if (!payment) {
                        return res.status(404).json({ message: 'Payment not found' });
                    }
                    res.json(payment);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating payment', error: err.message });
            });
    } else {
        // If not an ObjectId, try to update by some other field
        Payment.findOneAndUpdate({ paymentId: req.params.id }, req.body, { new: true })
            .then(payment => {
                if (!res.headersSent) {
                    if (!payment) {
                        return res.status(404).json({ message: 'Payment not found' });
                    }
                    res.json(payment);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating payment', error: err.message });
            });
    }
});

// Certificate Routes
app.get('/api/certificates/:studentId', (req, res) => {
    if (res.headersSent) return;
    Certificate.find({ studentId: req.params.studentId })
        .then(certificates => {
            if (!res.headersSent) res.json(certificates);
        })
        .catch(err => {
            if (!res.headersSent) res.status(500).json({ message: 'Server error' });
        });
});

// Updated to handle both _id and certificateId
app.get('/api/certificates/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, find by _id
        Certificate.findById(req.params.id)
            .then(certificate => {
                if (!res.headersSent) {
                    if (!certificate) {
                        return res.status(404).json({ message: 'Certificate not found' });
                    }
                    res.json(certificate);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    } else {
        // If not an ObjectId, try to find by some other field
        Certificate.findOne({ certificateId: req.params.id })
            .then(certificate => {
                if (!res.headersSent) {
                    if (!certificate) {
                        return res.status(404).json({ message: 'Certificate not found' });
                    }
                    res.json(certificate);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(500).json({ message: 'Server error' });
            });
    }
});

app.post('/api/certificates', (req, res) => {
    if (res.headersSent) return;
    console.log('POST /api/certificates request received:', req.body);
    try {
        const newCertificate = new Certificate(req.body);
        newCertificate.save()
            .then(certificate => {
                console.log('Certificate saved successfully:', certificate);
                if (!res.headersSent) res.status(201).json(certificate);
            })
            .catch(err => {
                console.error('Error saving certificate:', err);
                if (!res.headersSent) res.status(400).json({ message: 'Error creating certificate', error: err.message });
            });
    } catch (error) {
        console.error('Unexpected error in POST /api/certificates:', error);
        if (!res.headersSent) res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.put('/api/certificates/:id', (req, res) => {
    if (res.headersSent) return;
    
    // Check if the parameter looks like a MongoDB ObjectId
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    
    if (isObjectId) {
        // If it's an ObjectId, update by _id
        Certificate.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .then(certificate => {
                if (!res.headersSent) {
                    if (!certificate) {
                        return res.status(404).json({ message: 'Certificate not found' });
                    }
                    res.json(certificate);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating certificate', error: err.message });
            });
    } else {
        // If not an ObjectId, try to update by some other field
        Certificate.findOneAndUpdate({ certificateId: req.params.id }, req.body, { new: true })
            .then(certificate => {
                if (!res.headersSent) {
                    if (!certificate) {
                        return res.status(404).json({ message: 'Certificate not found' });
                    }
                    res.json(certificate);
                }
            })
            .catch(err => {
                if (!res.headersSent) res.status(400).json({ message: 'Error updating certificate', error: err.message });
            });
    }
});

// Dashboard Data
app.get('/api/dashboard/admin', (req, res) => {
    if (res.headersSent) return;
    Promise.all([
        Student.countDocuments(),
        Student.countDocuments({ status: 'Active' }),
        Student.countDocuments({ status: 'Dropped' }),
        Student.countDocuments({ status: 'Completed' }),
        Payment.countDocuments({ status: 'Free' }),
        Payment.countDocuments({ status: 'Paid' }),
        Payment.countDocuments({ status: 'Partial' })
    ])
    .then(([total, active, dropped, completed, free, paid, partial]) => {
        if (!res.headersSent) {
            res.json({
                totalStudents: total,
                activeStudents: active,
                droppedStudents: dropped,
                completedStudents: completed,
                freeStudents: free,
                paidStudents: paid,
                partialStudents: partial
            });
        }
    })
    .catch(err => {
        if (!res.headersSent) res.status(500).json({ message: 'Server error' });
    });
});

app.get('/api/dashboard/student/:studentId', (req, res) => {
    if (res.headersSent) return;
    const studentId = req.params.studentId;
    
    Promise.all([
        Student.findOne({ studentId }),
        Attendance.find({ studentId }),
        Quiz.find({ studentId }),
        Progress.find({ studentId }),
        Project.find({ studentId }),
        Payment.find({ studentId }),
        Certificate.find({ studentId })
    ])
    .then(([student, attendance, quizzes, progress, projects, payments, certificates]) => {
        // Calculate attendance percentage
        const totalClasses = attendance.length;
        const presentClasses = attendance.filter(a => a.status === 'Present').length;
        const attendancePercentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;
        
        // Calculate quiz stats
        const takenQuizzes = quizzes.filter(q => q.participation === 'Taken').length;
        const totalQuizzes = quizzes.length;
        const averageScore = takenQuizzes > 0 
            ? Math.round(quizzes.filter(q => q.participation === 'Taken').reduce((sum, q) => sum + q.score, 0) / takenQuizzes)
            : 0;
        
        // Get progress
        const courseProgress = progress.length > 0 ? progress[0] : null;
        const progressPercentage = courseProgress ? courseProgress.completionPercentage : 0;
        
        // Get project status
        const projectStatus = projects.length > 0 ? projects[0] : null;
        
        // Get payment status
        const paymentStatus = payments.length > 0 ? payments[0] : null;
        
        // Get certificate status
        const certificateStatus = certificates.length > 0 ? certificates[0] : null;
        
        if (!res.headersSent) {
            res.json({
                student: student,
                attendancePercentage: attendancePercentage,
                quizStats: {
                    taken: takenQuizzes,
                    total: totalQuizzes,
                    averageScore: averageScore
                },
                progressPercentage: progressPercentage,
                projectStatus: projectStatus,
                paymentStatus: paymentStatus,
                certificateStatus: certificateStatus
            });
        }
    })
    .catch(err => {
        if (!res.headersSent) res.status(500).json({ message: 'Server error' });
    });
});

// Debug route to list all registered routes
app.get('/api/routes', (req, res) => {
    if (res.headersSent) return;
    const routes = [];
    
    // List all routes manually
    routes.push(
        { path: '/api/login', methods: ['post'] },
        { path: '/api/students', methods: ['get', 'post'] },
        { path: '/api/students/:id', methods: ['get', 'put', 'delete'] },
        { path: '/api/courses', methods: ['get', 'post'] },
        { path: '/api/courses/:id', methods: ['get', 'put', 'delete'] },
        { path: '/api/attendance/:studentId', methods: ['get'] },
        { path: '/api/attendance/:id', methods: ['get', 'put', 'delete'] },
        { path: '/api/attendance', methods: ['post'] },
        { path: '/api/quizzes/:studentId', methods: ['get'] },
        { path: '/api/quizzes/:id', methods: ['get', 'put', 'delete'] },
        { path: '/api/quizzes', methods: ['post'] },
        { path: '/api/progress/:studentId', methods: ['get'] },
        { path: '/api/progress/:id', methods: ['put'] },
        { path: '/api/projects/:studentId', methods: ['get'] },
        { path: '/api/projects/:id', methods: ['get', 'put', 'delete'] },
        { path: '/api/projects', methods: ['post'] },
        { path: '/api/payments/:studentId', methods: ['get'] },
        { path: '/api/payments/:id', methods: ['get', 'put'] },
        { path: '/api/payments', methods: ['post'] },
        { path: '/api/certificates/:studentId', methods: ['get'] },
        { path: '/api/certificates/:id', methods: ['get', 'put'] },
        { path: '/api/certificates', methods: ['post'] },
        { path: '/api/dashboard/admin', methods: ['get'] },
        { path: '/api/dashboard/student/:studentId', methods: ['get'] },
        { path: '/api/routes', methods: ['get'] }
    );
    
    if (!res.headersSent) res.json(routes);
});

// Error handling middleware to catch all errors
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// 404 handler
app.use((req, res) => {
    console.log('404 for path:', req.path);
    if (!res.headersSent) {
        res.status(404).json({ message: 'Route not found' });
    }
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
