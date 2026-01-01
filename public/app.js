// app.js (updated version - fixing modal request interference)

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const loginPage = document.getElementById('loginPage');
    const adminDashboard = document.getElementById('adminDashboard');
    const studentDashboard = document.getElementById('studentDashboard');
    
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const studentLogoutBtn = document.getElementById('studentLogoutBtn');
    const loginError = document.getElementById('loginError');
    
    // Login Form Elements
    const studentIdInput = document.getElementById('studentId');
    const passwordInput = document.getElementById('password');
    
    // Current User
    let currentUser = null;
    
    // API Base URL
    const API_BASE = 'https://allaama-studenthub.onrender.com/api';
    
    // Track current section to prevent duplicate requests
    let currentSection = null;
    let isLoading = false;
    
    // Request management system - SEPARATE for section loading and modal operations
    const requestManager = {
        // For main section loading
        sectionController: null,
        // For modal operations
        modalControllers: new Set(),
        
        // Cancel section loading requests only
        cancelSectionRequests() {
            if (this.sectionController) {
                this.sectionController.abort();
                this.sectionController = null;
            }
        },
        
        // Cancel modal requests only
        cancelModalRequests() {
            this.modalControllers.forEach(controller => {
                controller.abort();
            });
            this.modalControllers.clear();
        },
        
        // Cancel ALL requests
        cancelAll() {
            this.cancelSectionRequests();
            this.cancelModalRequests();
        },
        
        // Create a controller for section loading
        createSectionController() {
            this.cancelSectionRequests(); // Cancel any existing section request
            this.sectionController = new AbortController();
            return this.sectionController;
        },
        
        // Create a controller for modal operations
        createModalController() {
            const controller = new AbortController();
            this.modalControllers.add(controller);
            return controller;
        },
        
        // Remove a modal controller when done
        removeModalController(controller) {
            this.modalControllers.delete(controller);
        }
    };
    
    // Debounce function to prevent rapid successive requests
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    // Event Listeners
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    studentLogoutBtn.addEventListener('click', handleLogout);
    
    // Admin Management Buttons with debouncing
    const debouncedLoadSection = debounce((section) => {
        loadManagementSection(section);
    }, 300);
    
    document.getElementById('manageStudentsBtn')?.addEventListener('click', () => {
        debouncedLoadSection('students');
    });
    
    document.getElementById('manageCoursesBtn')?.addEventListener('click', () => {
        debouncedLoadSection('courses');
    });
    
    document.getElementById('manageAttendanceBtn')?.addEventListener('click', () => {
        debouncedLoadSection('attendance');
    });
    
    document.getElementById('manageQuizzesBtn')?.addEventListener('click', () => {
        debouncedLoadSection('quizzes');
    });
    
    document.getElementById('manageProjectsBtn')?.addEventListener('click', () => {
        debouncedLoadSection('projects');
    });
    
    document.getElementById('managePaymentsBtn')?.addEventListener('click', () => {
        debouncedLoadSection('payments');
    });
    
    // Fixed typo: Changed debolatedLoadSection to debouncedLoadSection
    document.getElementById('manageCertificatesBtn')?.addEventListener('click', () => {
        debouncedLoadSection('certificates');
    });
    
    // Functions
    async function handleLogin() {
        const studentId = studentIdInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!studentId || !password) {
            showError('Please enter both Student ID and password');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId, password }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const data = await response.json();
            
            if (response.ok) {
                currentUser = data.user;
                loginError.textContent = '';
                
                if (currentUser.role === 'admin') {
                    showAdminDashboard();
                } else {
                    showStudentDashboard();
                }
            } else {
                showError(data.message || 'Login failed');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                showError('Server error. Please try again later.');
                console.error('Login error:', error);
            }
        }
    }
    
    function handleLogout() {
        // Cancel ALL requests when logging out
        requestManager.cancelAll();
        
        currentUser = null;
        studentIdInput.value = '';
        passwordInput.value = '';
        loginError.textContent = '';
        
        loginPage.classList.add('active');
        adminDashboard.classList.remove('active');
        studentDashboard.classList.remove('active');
    }
    
    function showError(message) {
        loginError.textContent = message;
    }
    
    function showAdminDashboard() {
        loginPage.classList.remove('active');
        adminDashboard.classList.add('active');
        document.getElementById('adminName').textContent = currentUser.fullName;
        
        loadAdminDashboardData();
    }
    
    function showStudentDashboard() {
        loginPage.classList.remove('active');
        studentDashboard.classList.add('active');
        document.getElementById('studentName').textContent = currentUser.fullName;
        
        loadStudentDashboardData();
    }
    
    async function loadAdminDashboardData() {
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/dashboard/admin`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const data = await response.json();
            
            if (response.ok) {
                document.getElementById('totalStudents').textContent = data.totalStudents;
                document.getElementById('activeStudents').textContent = data.activeStudents;
                document.getElementById('droppedStudents').textContent = data.droppedStudents;
                document.getElementById('completedStudents').textContent = data.completedStudents;
                document.getElementById('freeStudents').textContent = data.freeStudents;
                document.getElementById('paidStudents').textContent = data.paidStudents;
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error loading admin dashboard data:', error);
            }
        }
    }
    
    async function loadStudentDashboardData() {
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/dashboard/student/${currentUser.studentId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const data = await response.json();
            
            if (response.ok) {
                // Update profile information
                document.getElementById('profileStudentId').textContent = data.student.studentId;
                document.getElementById('profileFullName').textContent = data.student.fullName;
                document.getElementById('profileBatch').textContent = data.student.batch;
                document.getElementById('profileCourse').textContent = data.student.courseName;
                document.getElementById('profileEnrollmentDate').textContent = new Date(data.student.enrollmentDate).toLocaleDateString();
                document.getElementById('profileStatus').textContent = data.student.status;
                
                // Update stats
                document.getElementById('studentAttendancePercentage').textContent = data.attendancePercentage + '%';
                document.getElementById('studentProgressPercentage').textContent = data.progressPercentage + '%';
                document.getElementById('studentQuizAverage').textContent = data.quizStats.averageScore;
                document.getElementById('studentPaymentStatus').textContent = data.paymentStatus ? data.paymentStatus.status : 'N/A';
                document.getElementById('studentProjectStatus').textContent = data.projectStatus ? data.projectStatus.submissionStatus : 'N/A';
                document.getElementById('studentCertificateStatus').textContent = data.certificateStatus ? data.certificateStatus.status : 'N/A';
                
                // Load detailed data
                loadStudentAttendance();
                loadStudentQuizzes();
                loadStudentProjects();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error loading student dashboard data:', error);
            }
        }
    }
    
    async function loadStudentAttendance() {
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/attendance/${currentUser.studentId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const attendanceData = await response.json();
            
            if (response.ok) {
                const tbody = document.getElementById('attendanceTableBody');
                tbody.innerHTML = '';
                
                attendanceData.forEach(record => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(record.date).toLocaleDateString()}</td>
                        <td>${record.course}</td>
                        <td>${record.classType}</td>
                        <td>${record.status}</td>
                    `;
                    tbody.appendChild(row);
                });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error loading attendance data:', error);
            }
        }
    }
    
    async function loadStudentQuizzes() {
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/quizzes/${currentUser.studentId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const quizData = await response.json();
            
            if (response.ok) {
                const tbody = document.getElementById('quizTableBody');
                tbody.innerHTML = '';
                
                quizData.forEach(quiz => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${quiz.quizId}</td>
                        <td>${new Date(quiz.date).toLocaleDateString()}</td>
                        <td>${quiz.topic}</td>
                        <td>${quiz.participation}</td>
                        <td>${quiz.score || 'N/A'}</td>
                        <td>${quiz.passFail || 'N/A'}</td>
                    `;
                    tbody.appendChild(row);
                });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error loading quiz data:', error);
            }
        }
    }
    
    async function loadStudentProjects() {
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/projects/${currentUser.studentId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const projectData = await response.json();
            
            if (response.ok) {
                const tbody = document.getElementById('projectTableBody');
                tbody.innerHTML = '';
                
                projectData.forEach(project => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${project.projectName}</td>
                        <td>${project.course}</td>
                        <td>${project.submissionStatus}</td>
                        <td>${project.reviewStatus}</td>
                        <td>${project.score || 'N/A'}</td>
                    `;
                    tbody.appendChild(row);
                });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error loading project data:', error);
            }
        }
    }
    
    async function loadManagementSection(section) {
        // Prevent duplicate requests
        if (isLoading) {
            console.log('Already loading, skipping request');
            return;
        }
        
        // If clicking the same section, don't reload
        if (currentSection === section) {
            console.log('Already on this section, skipping reload');
            return;
        }
        
        // Cancel any ongoing SECTION requests (not modal requests)
        requestManager.cancelSectionRequests();
        
        // Close any open modal before loading a new section
        if (window.currentModal) {
            closeModal();
        }
        
        isLoading = true;
        currentSection = section;
        
        const managementSection = document.getElementById('managementSection');
        managementSection.innerHTML = '<div class="loading">Loading...</div>';
        
        try {
            let response;
            let data;
            let sectionTitle;
            let tableHeaders;
            let tableData;
            
            // Create a new controller for SECTION loading only
            const controller = requestManager.createSectionController();
            
            // Set a timeout for the entire operation
            const timeoutId = setTimeout(() => {
                requestManager.cancelSectionRequests();
                isLoading = false;
                managementSection.innerHTML = `<p>Request timed out. Please try again.</p>`;
            }, 10000);
            
            switch (section) {
                case 'students':
                    sectionTitle = 'Manage Students';
                    tableHeaders = ['Student ID', 'Full Name', 'Batch', 'Course', 'Status', 'Actions'];
                    
                    try {
                        response = await fetch(`${API_BASE}/students`, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        data = await response.json();
                        
                        tableData = data.map(student => `
                            <tr>
                                <td>${student.studentId}</td>
                                <td>${student.fullName}</td>
                                <td>${student.batch}</td>
                                <td>${student.courseName}</td>
                                <td>${student.status}</td>
                                <td class="table-actions">
                                    <button class="btn btn-small btn-edit" onclick="editStudent('${student._id}')">Edit</button>
                                    <button class="btn btn-small btn-delete" onclick="deleteStudent('${student.studentId}')">Delete</button>
                                </td>
                            </tr>
                        `).join('');
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            clearTimeout(timeoutId);
                            managementSection.innerHTML = `<p>Error loading data. Please try again.</p>`;
                        }
                        isLoading = false;
                        return;
                    }
                    
                    const addStudentForm = `
                        <div class="form-container">
                            <h3>Add New Student</h3>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="newStudentId">Student ID</label>
                                    <input type="text" id="newStudentId" required>
                                </div>
                                <div class="form-group">
                                    <label for="newFullName">Full Name</label>
                                    <input type="text" id="newFullName" required>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="newBatch">Batch</label>
                                    <input type="text" id="newBatch" required>
                                </div>
                                <div class="form-group">
                                    <label for="newCourse">Course</label>
                                    <input type="text" id="newCourse" required>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="newPassword">Password</label>
                                    <input type="password" id="newPassword" required>
                                </div>
                                <div class="form-group">
                                    <label for="newRole">Role</label>
                                    <select id="newRole">
                                        <option value="student">Student</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-actions">
                                <button class="btn btn-add" onclick="addStudent()">Add Student</button>
                            </div>
                        </div>
                    `;
                    
                    managementSection.innerHTML = `
                        <h2>${sectionTitle}</h2>
                        ${addStudentForm}
                        <div class="data-table">
                            <table>
                                <thead>
                                    <tr>
                                        ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableData}
                                </tbody>
                            </table>
                        </div>
                    `;
                    break;
                    
                case 'courses':
                    sectionTitle = 'Manage Courses';
                    tableHeaders = ['Name', 'Total Lessons', 'Duration', 'Batch', 'Actions'];
                    
                    try {
                        response = await fetch(`${API_BASE}/courses`, { signal: controller.signal });
                        clearTimeout(timeoutId);
                        data = await response.json();
                        
                        tableData = data.map(course => `
                            <tr>
                                <td>${course.name}</td>
                                <td>${course.totalLessons}</td>
                                <td>${course.duration}</td>
                                <td>${course.batch}</td>
                                <td class="table-actions">
                                    <button class="btn btn-small btn-edit" onclick="editCourse('${course._id}')">Edit</button>
                                    <button class="btn btn-small btn-delete" onclick="deleteCourse('${course._id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('');
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            clearTimeout(timeoutId);
                            managementSection.innerHTML = `<p>Error loading data. Please try again.</p>`;
                        }
                        isLoading = false;
                        return;
                    }
                    
                    const addCourseForm = `
                        <div class="form-container">
                            <h3>Add New Course</h3>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="newCourseName">Course Name</label>
                                    <input type="text" id="newCourseName" required>
                                </div>
                                <div class="form-group">
                                    <label for="newTotalLessons">Total Lessons</label>
                                    <input type="number" id="newTotalLessons" required>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="newDuration">Duration</label>
                                    <input type="text" id="newDuration" required>
                                </div>
                                <div class="form-group">
                                    <label for="newCourseBatch">Batch</label>
                                    <input type="text" id="newCourseBatch" required>
                                </div>
                            </div>
                            <div class="form-actions">
                                <button class="btn btn-add" onclick="addCourse()">Add Course</button>
                            </div>
                        </div>
                    `;
                    
                    managementSection.innerHTML = `
                        <h2>${sectionTitle}</h2>
                        ${addCourseForm}
                        <div class="data-table">
                            <table>
                                <thead>
                                    <tr>
                                        ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableData}
                                </tbody>
                            </table>
                        </div>
                    `;
                    break;
                    
                case 'attendance':
                    sectionTitle = 'Manage Attendance';
                    tableHeaders = ['Student ID', 'Date', 'Course', 'Class Type', 'Status', 'Actions'];
                    
                    try {
                        // First get students
                        const studentsResponse = await fetch(`${API_BASE}/students`, { signal: controller.signal });
                        const students = await studentsResponse.json();
                        
                        // Get all attendance records
                        const attendancePromises = students.map(student => {
                            const studentController = requestManager.createModalController();
                            return fetch(`${API_BASE}/attendance/${student.studentId}`, { signal: studentController.signal })
                                .then(res => {
                                    requestManager.removeModalController(studentController);
                                    return res.json();
                                })
                                .then(records => records.map(record => ({ ...record, studentId: student.studentId })))
                                .catch(err => {
                                    console.error(`Error fetching attendance for student ${student.studentId}:`, err);
                                    return [];
                                });
                        });
                        
                        const attendanceArrays = await Promise.all(attendancePromises);
                        const allAttendance = attendanceArrays.flat();
                        
                        clearTimeout(timeoutId);
                        
                        tableData = allAttendance.map(record => `
                            <tr>
                                <td>${record.studentId}</td>
                                <td>${new Date(record.date).toLocaleDateString()}</td>
                                <td>${record.course}</td>
                                <td>${record.classType}</td>
                                <td>${record.status}</td>
                                <td class="table-actions">
                                    <button class="btn btn-small btn-edit" onclick="editAttendance('${record._id}')">Edit</button>
                                    <button class="btn btn-small btn-delete" onclick="deleteAttendance('${record._id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('');
                        
                        const addAttendanceForm = `
                            <div class="form-container">
                                <h3>Add New Attendance Record</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="attendanceStudentId">Student ID</label>
                                        <select id="attendanceStudentId">
                                            ${students ? students.map(student => `<option value="${student.studentId}">${student.studentId} - ${student.fullName}</option>`).join('') : ''}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="attendanceDate">Date</label>
                                        <input type="date" id="attendanceDate" required>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="attendanceCourse">Course</label>
                                        <input type="text" id="attendanceCourse" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="attendanceClassType">Class Type</label>
                                        <select id="attendanceClassType">
                                            <option value="Lecture">Lecture</option>
                                            <option value="Quiz">Quiz</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="attendanceStatus">Status</label>
                                        <select id="attendanceStatus">
                                            <option value="Present">Present</option>
                                            <option value="Absent">Absent</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button class="btn btn-add" onclick="addAttendance()">Add Attendance</button>
                                </div>
                            </div>
                        `;
                        
                        managementSection.innerHTML = `
                            <h2>${sectionTitle}</h2>
                            ${addAttendanceForm}
                            <div class="data-table">
                                <table>
                                    <thead>
                                        <tr>
                                            ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tableData}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            clearTimeout(timeoutId);
                            managementSection.innerHTML = `<p>Error loading data. Please try again.</p>`;
                        }
                        isLoading = false;
                        return;
                    }
                    break;
                    
                case 'quizzes':
                    sectionTitle = 'Manage Quizzes';
                    tableHeaders = ['Quiz ID', 'Date', 'Topic', 'Course', 'Student ID', 'Participation', 'Score', 'Pass/Fail', 'Actions'];
                    
                    try {
                        // First get students
                        const studentsResponse = await fetch(`${API_BASE}/students`, { signal: controller.signal });
                        const quizStudents = await studentsResponse.json();
                        
                        // Get all quiz records
                        const quizPromises = quizStudents.map(student => {
                            const studentController = requestManager.createModalController();
                            return fetch(`${API_BASE}/quizzes/${student.studentId}`, { signal: studentController.signal })
                                .then(res => {
                                    requestManager.removeModalController(studentController);
                                    return res.json();
                                })
                                .then(records => records.map(record => ({ ...record, studentId: student.studentId })))
                                .catch(err => {
                                    console.error(`Error fetching quizzes for student ${student.studentId}:`, err);
                                    return [];
                                });
                        });
                        
                        const quizArrays = await Promise.all(quizPromises);
                        const allQuizzes = quizArrays.flat();
                        
                        clearTimeout(timeoutId);
                        
                        tableData = allQuizzes.map(quiz => `
                            <tr>
                                <td>${quiz.quizId}</td>
                                <td>${new Date(quiz.date).toLocaleDateString()}</td>
                                <td>${quiz.topic}</td>
                                <td>${quiz.course}</td>
                                <td>${quiz.studentId}</td>
                                <td>${quiz.participation}</td>
                                <td>${quiz.score || 'N/A'}</td>
                                <td>${quiz.passFail || 'N/A'}</td>
                                <td class="table-actions">
                                    <button class="btn btn-small btn-edit" onclick="editQuiz('${quiz._id}')">Edit</button>
                                    <button class="btn btn-small btn-delete" onclick="deleteQuiz('${quiz._id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('');
                        
                        const addQuizForm = `
                            <div class="form-container">
                                <h3>Add New Quiz</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="quizId">Quiz ID</label>
                                        <input type="text" id="quizId" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="quizDate">Date</label>
                                        <input type="date" id="quizDate" required>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="quizTopic">Topic</label>
                                        <input type="text" id="quizTopic" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="quizCourse">Course</label>
                                        <input type="text" id="quizCourse" required>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="quizStudentId">Student ID</label>
                                        <select id="quizStudentId">
                                            ${quizStudents ? quizStudents.map(student => `<option value="${student.studentId}">${student.studentId} - ${student.fullName}</option>`).join('') : ''}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="quizParticipation">Participation</label>
                                        <select id="quizParticipation">
                                            <option value="Taken">Taken</option>
                                            <option value="Missed">Missed</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="quizScore">Score</label>
                                        <input type="number" id="quizScore" min="0" max="100">
                                    </div>
                                    <div class="form-group">
                                        <label for="quizPassFail">Pass/Fail</label>
                                        <select id="quizPassFail">
                                            <option value="Pass">Pass</option>
                                            <option value="Fail">Fail</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button class="btn btn-add" onclick="addQuiz()">Add Quiz</button>
                                </div>
                            </div>
                        `;
                        
                        managementSection.innerHTML = `
                            <h2>${sectionTitle}</h2>
                            ${addQuizForm}
                            <div class="data-table">
                                <table>
                                    <thead>
                                        <tr>
                                            ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tableData}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            clearTimeout(timeoutId);
                            managementSection.innerHTML = `<p>Error loading data. Please try again.</p>`;
                        }
                        isLoading = false;
                        return;
                    }
                    break;
                    
                case 'projects':
                    sectionTitle = 'Manage Projects';
                    tableHeaders = ['Student ID', 'Project Name', 'Course', 'Submission Status', 'Review Status', 'Score', 'Actions'];
                    
                    try {
                        // First get students
                        const studentsResponse = await fetch(`${API_BASE}/students`, { signal: controller.signal });
                        const projectStudents = await studentsResponse.json();
                        
                        // Get all project records
                        const projectPromises = projectStudents.map(student => {
                            const studentController = requestManager.createModalController();
                            return fetch(`${API_BASE}/projects/${student.studentId}`, { signal: studentController.signal })
                                .then(res => {
                                    requestManager.removeModalController(studentController);
                                    return res.json();
                                })
                                .then(records => records.map(record => ({ ...record, studentId: student.studentId })))
                                .catch(err => {
                                    console.error(`Error fetching projects for student ${student.studentId}:`, err);
                                    return [];
                                });
                        });
                        
                        const projectArrays = await Promise.all(projectPromises);
                        const allProjects = projectArrays.flat();
                        
                        clearTimeout(timeoutId);
                        
                        tableData = allProjects.map(project => `
                            <tr>
                                <td>${project.studentId}</td>
                                <td>${project.projectName}</td>
                                <td>${project.course}</td>
                                <td>${project.submissionStatus}</td>
                                <td>${project.reviewStatus}</td>
                                <td>${project.score || 'N/A'}</td>
                                <td class="table-actions">
                                    <button class="btn btn-small btn-edit" onclick="editProject('${project._id}')">Edit</button>
                                    <button class="btn btn-small btn-delete" onclick="deleteProject('${project._id}')">Delete</button>
                                </td>
                            </tr>
                        `).join('');
                        
                        const addProjectForm = `
                            <div class="form-container">
                                <h3>Add New Project</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="projectStudentId">Student ID</label>
                                        <select id="projectStudentId">
                                            ${projectStudents ? projectStudents.map(student => `<option value="${student.studentId}">${student.studentId} - ${student.fullName}</option>`).join('') : ''}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="projectName">Project Name</label>
                                        <input type="text" id="projectName" required>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="projectCourse">Course</label>
                                        <input type="text" id="projectCourse" required>
                                    </div>
                                    <div class="form-group">
                                        <label for="projectSubmissionStatus">Submission Status</label>
                                        <select id="projectSubmissionStatus">
                                            <option value="Submitted">Submitted</option>
                                            <option value="Missing">Missing</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="projectReviewStatus">Review Status</label>
                                        <select id="projectReviewStatus">
                                            <option value="Approved">Approved</option>
                                            <option value="Not Approved">Not Approved</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="projectScore">Score</label>
                                        <input type="number" id="projectScore" min="0" max="100">
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button class="btn btn-add" onclick="addProject()">Add Project</button>
                                </div>
                            </div>
                        `;
                        
                        managementSection.innerHTML = `
                            <h2>${sectionTitle}</h2>
                            ${addProjectForm}
                            <div class="data-table">
                                <table>
                                    <thead>
                                        <tr>
                                            ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tableData}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            clearTimeout(timeoutId);
                            managementSection.innerHTML = `<p>Error loading data. Please try again.</p>`;
                        }
                        isLoading = false;
                        return;
                    }
                    break;
                    
                case 'payments':
                    sectionTitle = 'Manage Payments';
                    tableHeaders = ['Student ID', 'Status', 'Amount Paid', 'Balance', 'Payment Date', 'Actions'];
                    
                    try {
                        // First get students
                        const studentsResponse = await fetch(`${API_BASE}/students`, { signal: controller.signal });
                        const paymentStudents = await studentsResponse.json();
                        
                        // Get all payment records
                        const paymentPromises = paymentStudents.map(student => {
                            const studentController = requestManager.createModalController();
                            return fetch(`${API_BASE}/payments/${student.studentId}`, { signal: studentController.signal })
                                .then(res => {
                                    requestManager.removeModalController(studentController);
                                    return res.json();
                                })
                                .then(records => records.map(record => ({ ...record, studentId: student.studentId })))
                                .catch(err => {
                                    console.error(`Error fetching payments for student ${student.studentId}:`, err);
                                    return [];
                                });
                        });
                        
                        const paymentArrays = await Promise.all(paymentPromises);
                        const allPayments = paymentArrays.flat();
                        
                        clearTimeout(timeoutId);
                        
                        tableData = allPayments.map(payment => `
                            <tr>
                                <td>${payment.studentId}</td>
                                <td>${payment.status}</td>
                                <td>${payment.amountPaid || '0'}</td>
                                <td>${payment.balance || '0'}</td>
                                <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : 'N/A'}</td>
                                <td class="table-actions">
                                    <button class="btn btn-small btn-edit" onclick="editPayment('${payment._id}')">Edit</button>
                                </td>
                            </tr>
                        `).join('');
                        
                        const addPaymentForm = `
                            <div class="form-container">
                                <h3>Add New Payment</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="paymentStudentId">Student ID</label>
                                        <select id="paymentStudentId">
                                            ${paymentStudents ? paymentStudents.map(student => `<option value="${student.studentId}">${student.studentId} - ${student.fullName}</option>`).join('') : ''}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="paymentStatus">Status</label>
                                        <select id="paymentStatus">
                                            <option value="Free">Free</option>
                                            <option value="Paid">Paid</option>
                                            <option value="Partial">Partial</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="paymentAmountPaid">Amount Paid</label>
                                        <input type="number" id="paymentAmountPaid" min="0">
                                    </div>
                                    <div class="form-group">
                                        <label for="paymentBalance">Balance</label>
                                        <input type="number" id="paymentBalance" min="0">
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="paymentDate">Payment Date</label>
                                        <input type="date" id="paymentDate">
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button class="btn btn-add" onclick="addPayment()">Add Payment</button>
                                </div>
                            </div>
                        `;
                        
                        managementSection.innerHTML = `
                            <h2>${sectionTitle}</h2>
                            ${addPaymentForm}
                            <div class="data-table">
                                <table>
                                    <thead>
                                        <tr>
                                            ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tableData}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            clearTimeout(timeoutId);
                            managementSection.innerHTML = `<p>Error loading data. Please try again.</p>`;
                        }
                        isLoading = false;
                        return;
                    }
                    break;
                    
                case 'certificates':
                    sectionTitle = 'Manage Certificates';
                    tableHeaders = ['Student ID', 'Status', 'Requested', 'Created', 'Actions'];
                    
                    try {
                        // First get students
                        const studentsResponse = await fetch(`${API_BASE}/students`, { signal: controller.signal });
                        const certificateStudents = await studentsResponse.json();
                        
                        // Get all certificate records
                        const certificatePromises = certificateStudents.map(student => {
                            const studentController = requestManager.createModalController();
                            return fetch(`${API_BASE}/certificates/${student.studentId}`, { signal: studentController.signal })
                                .then(res => {
                                    requestManager.removeModalController(studentController);
                                    return res.json();
                                })
                                .then(records => records.map(record => ({ ...record, studentId: student.studentId })))
                                .catch(err => {
                                    console.error(`Error fetching certificates for student ${student.studentId}:`, err);
                                    return [];
                                });
                        });
                        
                        const certificateArrays = await Promise.all(certificatePromises);
                        const allCertificates = certificateArrays.flat();
                        
                        clearTimeout(timeoutId);
                        
                        tableData = allCertificates.map(certificate => `
                            <tr>
                                <td>${certificate.studentId}</td>
                                <td>${certificate.status}</td>
                                <td>${certificate.requested ? 'Yes' : 'No'}</td>
                                <td>${certificate.created ? 'Yes' : 'No'}</td>
                                <td class="table-actions">
                                    <button class="btn btn-small btn-edit" onclick="editCertificate('${certificate._id}')">Edit</button>
                                    ${!certificate.created ? `<button class="btn btn-small btn-add" onclick="createCertificate('${certificate._id}')">Create</button>` : ''}
                                </td>
                            </tr>
                        `).join('');
                        
                        const addCertificateForm = `
                            <div class="form-container">
                                <h3>Add New Certificate</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="certificateStudentId">Student ID</label>
                                        <select id="certificateStudentId">
                                            ${certificateStudents ? certificateStudents.map(student => `<option value="${student.studentId}">${student.studentId} - ${student.fullName}</option>`).join('') : ''}
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="certificateStatus">Status</label>
                                        <select id="certificateStatus">
                                            <option value="Eligible">Eligible</option>
                                            <option value="Not Eligible">Not Eligible</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="certificateRequested">Requested</label>
                                        <select id="certificateRequested">
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="certificateCreated">Created</label>
                                        <select id="certificateCreated">
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-actions">
                                    <button class="btn btn-add" onclick="addCertificate()">Add Certificate</button>
                                </div>
                            </div>
                        `;
                        
                        managementSection.innerHTML = `
                            <h2>${sectionTitle}</h2>
                            ${addCertificateForm}
                            <div class="data-table">
                                <table>
                                    <thead>
                                        <tr>
                                            ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tableData}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            clearTimeout(timeoutId);
                            managementSection.innerHTML = `<p>Error loading data. Please try again.</p>`;
                        }
                        isLoading = false;
                        return;
                    }
                    break;
                    
                default:
                    managementSection.innerHTML = `<h2>${sectionTitle}</h2><p>Management section for ${section} would be implemented here.</p>`;
            }
            
            isLoading = false;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error(`Error loading ${section} data:`, error);
                managementSection.innerHTML = `<p>Error loading data. Please try again.</p>`;
            }
            isLoading = false;
        }
    }
    
    // Global functions for management actions (to be called from inline onclick)
    window.addStudent = async function() {
        const studentId = document.getElementById('newStudentId').value.trim();
        const fullName = document.getElementById('newFullName').value.trim();
        const batch = document.getElementById('newBatch').value.trim();
        const courseName = document.getElementById('newCourse').value.trim();
        const password = document.getElementById('newPassword').value.trim();
        const role = document.getElementById('newRole').value;
        
        if (!studentId || !fullName || !batch || !courseName || !password) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/students`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId, fullName, batch, courseName, password, role }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Student added successfully');
                loadManagementSection('students');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error adding student:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.editStudent = async function(studentId) {
        try {
            // Fetch student data using MongoDB _id, not studentId
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/students/${studentId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const student = await response.json();
            
            if (!response.ok) {
                alert('Error fetching student data');
                return;
            }
            
            // Create a modal for editing
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Student</h3>
                        <span class="close" onclick="closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="editStudentId">Student ID</label>
                            <input type="text" id="editStudentId" value="${student.studentId}" readonly>
                        </div>
                        <div class="form-group">
                            <label for="editFullName">Full Name</label>
                            <input type="text" id="editFullName" value="${student.fullName}" required>
                        </div>
                        <div class="form-group">
                            <label for="editBatch">Batch</label>
                            <input type="text" id="editBatch" value="${student.batch}" required>
                        </div>
                        <div class="form-group">
                            <label for="editCourseName">Course</label>
                            <input type="text" id="editCourseName" value="${student.courseName}" required>
                        </div>
                        <div class="form-group">
                            <label for="editStatus">Status</label>
                            <select id="editStatus">
                                <option value="Active" ${student.status === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="At Risk" ${student.status === 'At Risk' ? 'selected' : ''}>At Risk</option>
                                <option value="Completed" ${student.status === 'Completed' ? 'selected' : ''}>Completed</option>
                                <option value="Dropped" ${student.status === 'Dropped' ? 'selected' : ''}>Dropped</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editRole">Role</label>
                            <select id="editRole">
                                <option value="student" ${student.role === 'student' ? 'selected' : ''}>Student</option>
                                <option value="admin" ${student.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="updateStudent('${student._id}')">Update</button>
                            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'block';
            
            // Make the modal globally accessible
            window.currentModal = modal;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening edit student modal:', error);
                alert('Error opening edit form');
            }
        }
    };
    
    window.updateStudent = async function(studentId) {
        const fullName = document.getElementById('editFullName').value.trim();
        const batch = document.getElementById('editBatch').value.trim();
        const courseName = document.getElementById('editCourseName').value.trim();
        const status = document.getElementById('editStatus').value;
        const role = document.getElementById('editRole').value;
        
        if (!fullName || !batch || !courseName) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/students/${studentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fullName, batch, courseName, status, role }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Student updated successfully');
                closeModal();
                loadManagementSection('students');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error updating student:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.deleteStudent = async function(studentId) {
        if (confirm(`Are you sure you want to delete student ${studentId}?`)) {
            try {
                const controller = requestManager.createModalController();
                const response = await fetch(`${API_BASE}/students/${studentId}`, {
                    method: 'DELETE',
                    signal: controller.signal
                });
                
                requestManager.removeModalController(controller);
                
                if (response.ok) {
                    alert('Student deleted successfully');
                    loadManagementSection('students');
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.message}`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error deleting student:', error);
                    alert('Server error. Please try again later.');
                }
            }
        }
    };
    
    window.addCourse = async function() {
        const name = document.getElementById('newCourseName').value.trim();
        const totalLessons = document.getElementById('newTotalLessons').value.trim();
        const duration = document.getElementById('newDuration').value.trim();
        const batch = document.getElementById('newCourseBatch').value.trim();
        
        if (!name || !totalLessons || !duration || !batch) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/courses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, totalLessons, duration, batch }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Course added successfully');
                loadManagementSection('courses');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error adding course:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.editCourse = async function(courseId) {
        try {
            // Fetch the course data
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/courses/${courseId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const course = await response.json();
            
            if (!response.ok) {
                alert('Error fetching course data');
                return;
            }
            
            // Create a modal for editing
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Course</h3>
                        <span class="close" onclick="closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="editCourseName">Course Name</label>
                            <input type="text" id="editCourseName" value="${course.name}" required>
                        </div>
                        <div class="form-group">
                            <label for="editTotalLessons">Total Lessons</label>
                            <input type="number" id="editTotalLessons" value="${course.totalLessons}" required>
                        </div>
                        <div class="form-group">
                            <label for="editDuration">Duration</label>
                            <input type="text" id="editDuration" value="${course.duration}" required>
                        </div>
                        <div class="form-group">
                            <label for="editBatch">Batch</label>
                            <input type="text" id="editBatch" value="${course.batch}" required>
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="updateCourse('${course._id}')">Update</button>
                            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'block';
            
            // Make the modal globally accessible
            window.currentModal = modal;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening edit course modal:', error);
                alert('Error opening edit form');
            }
        }
    };
    
    window.updateCourse = async function(courseId) {
        const name = document.getElementById('editCourseName').value.trim();
        const totalLessons = document.getElementById('editTotalLessons').value.trim();
        const duration = document.getElementById('editDuration').value.trim();
        const batch = document.getElementById('editBatch').value.trim();
        
        if (!name || !totalLessons || !duration || !batch) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/courses/${courseId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, totalLessons, duration, batch }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Course updated successfully');
                closeModal();
                loadManagementSection('courses');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error updating course:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.deleteCourse = async function(courseId) {
        if (confirm(`Are you sure you want to delete this course?`)) {
            try {
                const controller = requestManager.createModalController();
                const response = await fetch(`${API_BASE}/courses/${courseId}`, {
                    method: 'DELETE',
                    signal: controller.signal
                });
                
                requestManager.removeModalController(controller);
                
                if (response.ok) {
                    alert('Course deleted successfully');
                    loadManagementSection('courses');
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.message}`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error deleting course:', error);
                    alert('Server error. Please try again later.');
                }
            }
        }
    };
    
    // Attendance management functions
    window.addAttendance = async function() {
        const studentId = document.getElementById('attendanceStudentId').value;
        const date = document.getElementById('attendanceDate').value;
        const course = document.getElementById('attendanceCourse').value.trim();
        const classType = document.getElementById('attendanceClassType').value;
        const status = document.getElementById('attendanceStatus').value;
        
        if (!studentId || !date || !course) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/attendance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId, date, course, classType, status }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Attendance record added successfully');
                loadManagementSection('attendance');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error adding attendance:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.editAttendance = async function(attendanceId) {
        try {
            // Fetch the attendance data
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/attendance/${attendanceId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const attendance = await response.json();
            
            if (!response.ok || !attendance) {
                alert('Error fetching attendance data');
                return;
            }
            
            // Format date properly for the input
            const formattedDate = attendance.date ? new Date(attendance.date).toISOString().split('T')[0] : '';
            
            // Create a modal for editing
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Attendance</h3>
                        <span class="close" onclick="closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="editStudentId">Student ID</label>
                            <input type="text" id="editStudentId" value="${attendance.studentId || ''}" readonly>
                        </div>
                        <div class="form-group">
                            <label for="editDate">Date</label>
                            <input type="date" id="editDate" value="${formattedDate}" required>
                        </div>
                        <div class="form-group">
                            <label for="editCourse">Course</label>
                            <input type="text" id="editCourse" value="${attendance.course || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editClassType">Class Type</label>
                            <select id="editClassType">
                                <option value="Lecture" ${attendance.classType === 'Lecture' ? 'selected' : ''}>Lecture</option>
                                <option value="Quiz" ${attendance.classType === 'Quiz' ? 'selected' : ''}>Quiz</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editStatus">Status</label>
                            <select id="editStatus">
                                <option value="Present" ${attendance.status === 'Present' ? 'selected' : ''}>Present</option>
                                <option value="Absent" ${attendance.status === 'Absent' ? 'selected' : ''}>Absent</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="updateAttendance('${attendance._id}')">Update</button>
                            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'block';
            
            // Make the modal globally accessible
            window.currentModal = modal;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening edit attendance modal:', error);
                alert('Error opening edit form');
            }
        }
    };
    
    window.updateAttendance = async function(attendanceId) {
        const date = document.getElementById('editDate').value;
        const course = document.getElementById('editCourse').value.trim();
        const classType = document.getElementById('editClassType').value;
        const status = document.getElementById('editStatus').value;
        
        if (!date || !course) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/attendance/${attendanceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ date, course, classType, status }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Attendance updated successfully');
                closeModal();
                loadManagementSection('attendance');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error updating attendance:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.deleteAttendance = async function(attendanceId) {
        if (confirm(`Are you sure you want to delete this attendance record?`)) {
            try {
                const controller = requestManager.createModalController();
                const response = await fetch(`${API_BASE}/attendance/${attendanceId}`, {
                    method: 'DELETE',
                    signal: controller.signal
                });
                
                requestManager.removeModalController(controller);
                
                if (response.ok) {
                    alert('Attendance record deleted successfully');
                    loadManagementSection('attendance');
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.message}`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error deleting attendance:', error);
                    alert('Server error. Please try again later.');
                }
            }
        }
    };
    
    // Quiz management functions
    window.addQuiz = async function() {
        const quizIdValue = document.getElementById('quizId').value.trim(); // Changed from quizId to quizIdValue
        const date = document.getElementById('quizDate').value;
        const topic = document.getElementById('quizTopic').value.trim();
        const course = document.getElementById('quizCourse').value.trim();
        const studentId = document.getElementById('quizStudentId').value;
        const participation = document.getElementById('quizParticipation').value;
        const score = document.getElementById('quizScore').value;
        const passFail = document.getElementById('quizPassFail').value;
        
        if (!quizIdValue || !date || !topic || !course || !studentId) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/quizzes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ quizId: quizIdValue, date, topic, course, studentId, participation, score, passFail }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Quiz added successfully');
                loadManagementSection('quizzes');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error adding quiz:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.editQuiz = async function(quizId) {
        try {
            // Fetch the quiz data
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/quizzes/${quizId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const quiz = await response.json();
            
            if (!response.ok || !quiz) {
                alert('Error fetching quiz data');
                return;
            }
            
            // Format date properly for the input
            const formattedDate = quiz.date ? new Date(quiz.date).toISOString().split('T')[0] : '';
            
            // Create a modal for editing
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Quiz</h3>
                        <span class="close" onclick="closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="editQuizId">Quiz ID</label>
                            <input type="text" id="editQuizId" value="${quiz.quizId || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editDate">Date</label>
                            <input type="date" id="editDate" value="${formattedDate}" required>
                        </div>
                        <div class="form-group">
                            <label for="editTopic">Topic</label>
                            <input type="text" id="editTopic" value="${quiz.topic || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editCourse">Course</label>
                            <input type="text" id="editCourse" value="${quiz.course || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editStudentId">Student ID</label>
                            <input type="text" id="editStudentId" value="${quiz.studentId || ''}" readonly>
                        </div>
                        <div class="form-group">
                            <label for="editParticipation">Participation</label>
                            <select id="editParticipation">
                                <option value="Taken" ${quiz.participation === 'Taken' ? 'selected' : ''}>Taken</option>
                                <option value="Missed" ${quiz.participation === 'Missed' ? 'selected' : ''}>Missed</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editScore">Score</label>
                            <input type="number" id="editScore" value="${quiz.score || ''}" min="0" max="100">
                        </div>
                        <div class="form-group">
                            <label for="editPassFail">Pass/Fail</label>
                            <select id="editPassFail">
                                <option value="Pass" ${quiz.passFail === 'Pass' ? 'selected' : ''}>Pass</option>
                                <option value="Fail" ${quiz.passFail === 'Fail' ? 'selected' : ''}>Fail</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="updateQuiz('${quiz._id}')">Update</button>
                            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'block';
            
            // Make the modal globally accessible
            window.currentModal = modal;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening edit quiz modal:', error);
                alert('Error opening edit form');
            }
        }
    };
    
    window.updateQuiz = async function(quizId) {
        const quizIdValue = document.getElementById('editQuizId').value.trim(); // Changed from quizId to quizIdValue
        const date = document.getElementById('editDate').value;
        const topic = document.getElementById('editTopic').value.trim();
        const course = document.getElementById('editCourse').value.trim();
        const participation = document.getElementById('editParticipation').value;
        const score = document.getElementById('editScore').value;
        const passFail = document.getElementById('editPassFail').value;
        
        if (!quizIdValue || !date || !topic || !course) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/quizzes/${quizId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ quizId: quizIdValue, date, topic, course, participation, score, passFail }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Quiz updated successfully');
                closeModal();
                loadManagementSection('quizzes');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error updating quiz:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.deleteQuiz = async function(quizId) {
        if (confirm(`Are you sure you want to delete this quiz?`)) {
            try {
                const controller = requestManager.createModalController();
                const response = await fetch(`${API_BASE}/quizzes/${quizId}`, {
                    method: 'DELETE',
                    signal: controller.signal
                });
                
                requestManager.removeModalController(controller);
                
                if (response.ok) {
                    alert('Quiz deleted successfully');
                    loadManagementSection('quizzes');
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.message}`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error deleting quiz:', error);
                    alert('Server error. Please try again later.');
                }
            }
        }
    };
    
    // Project management functions
    window.addProject = async function() {
        const studentId = document.getElementById('projectStudentId').value;
        const projectName = document.getElementById('projectName').value.trim();
        const course = document.getElementById('projectCourse').value.trim();
        const submissionStatus = document.getElementById('projectSubmissionStatus').value;
        const reviewStatus = document.getElementById('projectReviewStatus').value;
        const score = document.getElementById('projectScore').value;
        
        if (!studentId || !projectName || !course) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId, projectName, course, submissionStatus, reviewStatus, score }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Project added successfully');
                loadManagementSection('projects');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error adding project:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.editProject = async function(projectId) {
        try {
            // Fetch the project data
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/projects/${projectId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const project = await response.json();
            
            if (!response.ok || !project) {
                alert('Error fetching project data');
                return;
            }
            
            // Create a modal for editing
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Project</h3>
                        <span class="close" onclick="closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="editStudentId">Student ID</label>
                            <input type="text" id="editStudentId" value="${project.studentId || ''}" readonly>
                        </div>
                        <div class="form-group">
                            <label for="editProjectName">Project Name</label>
                            <input type="text" id="editProjectName" value="${project.projectName || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editCourse">Course</label>
                            <input type="text" id="editCourse" value="${project.course || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editSubmissionStatus">Submission Status</label>
                            <select id="editSubmissionStatus">
                                <option value="Submitted" ${project.submissionStatus === 'Submitted' ? 'selected' : ''}>Submitted</option>
                                <option value="Missing" ${project.submissionStatus === 'Missing' ? 'selected' : ''}>Missing</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editReviewStatus">Review Status</label>
                            <select id="editReviewStatus">
                                <option value="Approved" ${project.reviewStatus === 'Approved' ? 'selected' : ''}>Approved</option>
                                <option value="Not Approved" ${project.reviewStatus === 'Not Approved' ? 'selected' : ''}>Not Approved</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editScore">Score</label>
                            <input type="number" id="editScore" value="${project.score || ''}" min="0" max="100">
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="updateProject('${project._id}')">Update</button>
                            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'block';
            
            // Make the modal globally accessible
            window.currentModal = modal;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening edit project modal:', error);
                alert('Error opening edit form');
            }
        }
    };
    
    window.updateProject = async function(projectId) {
        const projectName = document.getElementById('editProjectName').value.trim();
        const course = document.getElementById('editCourse').value.trim();
        const submissionStatus = document.getElementById('editSubmissionStatus').value;
        const reviewStatus = document.getElementById('editReviewStatus').value;
        const score = document.getElementById('editScore').value;
        
        if (!projectName || !course) {
            alert('Please fill in all required fields');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/projects/${projectId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ projectName, course, submissionStatus, reviewStatus, score }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Project updated successfully');
                closeModal();
                loadManagementSection('projects');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error updating project:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.deleteProject = async function(projectId) {
        if (confirm(`Are you sure you want to delete this project?`)) {
            try {
                const controller = requestManager.createModalController();
                const response = await fetch(`${API_BASE}/projects/${projectId}`, {
                    method: 'DELETE',
                    signal: controller.signal
                });
                
                requestManager.removeModalController(controller);
                
                if (response.ok) {
                    alert('Project deleted successfully');
                    loadManagementSection('projects');
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.message}`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error deleting project:', error);
                    alert('Server error. Please try again later.');
                }
            }
        }
    };
    
    // Payment management functions
    window.addPayment = async function() {
        const studentId = document.getElementById('paymentStudentId').value;
        const status = document.getElementById('paymentStatus').value;
        const amountPaid = document.getElementById('paymentAmountPaid').value;
        const balance = document.getElementById('paymentBalance').value;
        const paymentDate = document.getElementById('paymentDate').value;
        
        if (!studentId) {
            alert('Please select a student');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/payments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId, status, amountPaid, balance, paymentDate }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Payment added successfully');
                loadManagementSection('payments');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error adding payment:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.editPayment = async function(paymentId) {
        try {
            // Fetch the payment data
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/payments/${paymentId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const payment = await response.json();
            
            if (!response.ok || !payment) {
                alert('Error fetching payment data');
                return;
            }
            
            // Format date properly for the input
            const formattedDate = payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : '';
            
            // Create a modal for editing
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Payment</h3>
                        <span class="close" onclick="closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="editStudentId">Student ID</label>
                            <input type="text" id="editStudentId" value="${payment.studentId || ''}" readonly>
                        </div>
                        <div class="form-group">
                            <label for="editStatus">Status</label>
                            <select id="editStatus">
                                <option value="Free" ${payment.status === 'Free' ? 'selected' : ''}>Free</option>
                                <option value="Paid" ${payment.status === 'Paid' ? 'selected' : ''}>Paid</option>
                                <option value="Partial" ${payment.status === 'Partial' ? 'selected' : ''}>Partial</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editAmountPaid">Amount Paid</label>
                            <input type="number" id="editAmountPaid" value="${payment.amountPaid || '0'}" min="0">
                        </div>
                        <div class="form-group">
                            <label for="editBalance">Balance</label>
                            <input type="number" id="editBalance" value="${payment.balance || '0'}" min="0">
                        </div>
                        <div class="form-group">
                            <label for="editPaymentDate">Payment Date</label>
                            <input type="date" id="editPaymentDate" value="${formattedDate}">
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="updatePayment('${payment._id}')">Update</button>
                            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'block';
            
            // Make the modal globally accessible
            window.currentModal = modal;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening edit payment modal:', error);
                alert('Error opening edit form');
            }
        }
    };
    
    window.updatePayment = async function(paymentId) {
        const status = document.getElementById('editStatus').value;
        const amountPaid = document.getElementById('editAmountPaid').value;
        const balance = document.getElementById('editBalance').value;
        const paymentDate = document.getElementById('editPaymentDate').value;
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/payments/${paymentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status, amountPaid, balance, paymentDate }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Payment updated successfully');
                closeModal();
                loadManagementSection('payments');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error updating payment:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    // Certificate management functions
    window.addCertificate = async function() {
        const studentId = document.getElementById('certificateStudentId').value;
        const status = document.getElementById('certificateStatus').value;
        const requested = document.getElementById('certificateRequested').value === 'true';
        const created = document.getElementById('certificateCreated').value === 'true';
        
        if (!studentId) {
            alert('Please select a student');
            return;
        }
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/certificates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId, status, requested, created }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Certificate added successfully');
                loadManagementSection('certificates');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error adding certificate:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.editCertificate = async function(certificateId) {
        try {
            // Fetch the certificate data
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/certificates/${certificateId}`, {
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            const certificate = await response.json();
            
            if (!response.ok || !certificate) {
                alert('Error fetching certificate data');
                return;
            }
            
            // Create a modal for editing
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Edit Certificate</h3>
                        <span class="close" onclick="closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="editStudentId">Student ID</label>
                            <input type="text" id="editStudentId" value="${certificate.studentId || ''}" readonly>
                        </div>
                        <div class="form-group">
                            <label for="editStatus">Status</label>
                            <select id="editStatus">
                                <option value="Eligible" ${certificate.status === 'Eligible' ? 'selected' : ''}>Eligible</option>
                                <option value="Not Eligible" ${certificate.status === 'Not Eligible' ? 'selected' : ''}>Not Eligible</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editRequested">Requested</label>
                            <select id="editRequested">
                                <option value="true" ${certificate.requested ? 'selected' : ''}>Yes</option>
                                <option value="false" ${!certificate.requested ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editCreated">Created</label>
                            <select id="editCreated">
                                <option value="true" ${certificate.created ? 'selected' : ''}>Yes</option>
                                <option value="false" ${!certificate.created ? 'selected' : ''}>No</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="updateCertificate('${certificate._id}')">Update</button>
                            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.style.display = 'block';
            
            // Make the modal globally accessible
            window.currentModal = modal;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error opening edit certificate modal:', error);
                alert('Error opening edit form');
            }
        }
    };
    
    window.updateCertificate = async function(certificateId) {
        const status = document.getElementById('editStatus').value;
        const requested = document.getElementById('editRequested').value === 'true';
        const created = document.getElementById('editCreated').value === 'true';
        
        try {
            const controller = requestManager.createModalController();
            const response = await fetch(`${API_BASE}/certificates/${certificateId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status, requested, created }),
                signal: controller.signal
            });
            
            requestManager.removeModalController(controller);
            
            if (response.ok) {
                alert('Certificate updated successfully');
                closeModal();
                loadManagementSection('certificates');
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.message}`);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error updating certificate:', error);
                alert('Server error. Please try again later.');
            }
        }
    };
    
    window.createCertificate = async function(certificateId) {
        if (confirm(`Are you sure you want to create this certificate?`)) {
            try {
                const controller = requestManager.createModalController();
                const response = await fetch(`${API_BASE}/certificates/${certificateId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ created: true }),
                    signal: controller.signal
                });
                
                requestManager.removeModalController(controller);
                
                if (response.ok) {
                    alert('Certificate created successfully');
                    loadManagementSection('certificates');
                } else {
                    const errorData = await response.json();
                    alert(`Error: ${errorData.message}`);
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error creating certificate:', error);
                    alert('Server error. Please try again later.');
                }
            }
        }
    };
    
    // Modal functions
    window.closeModal = function() {
        if (window.currentModal) {
            document.body.removeChild(window.currentModal);
            window.currentModal = null;
        }
    };
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (window.currentModal && event.target === window.currentModal) {
            closeModal();
        }
    });
});
