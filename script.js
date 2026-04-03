// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let currentDoctor = null;
let currentAdmin = null;
let generatedOTP = null;
let pendingUserData = null;
let pendingDoctorData = null;
let vitalsInterval = null;
let localStream = null;
let isMicActive = true;
let isCamActive = true;
let uploadedFiles = [];

// For Forgot Password flow
let forgotTempData = { identifier: null, role: null, otp: null };

// Sample hospitals data
const hospitals = [
    { name: 'Apollo Hospital', address: 'MG Road, Bangalore', distance: '1.2 km', rating: 4.8, phone: '+91 80 1234 5678' },
    { name: 'Fortis Healthcare', address: 'Whitefield, Bangalore', distance: '2.5 km', rating: 4.6, phone: '+91 80 8765 4321' }
];

// ========== INITIALIZATION ==========
function initAdminAccount() {
    let admins = JSON.parse(localStorage.getItem('medisync_admins') || '[]');
    if (admins.length === 0) {
        admins.push({ id: Date.now(), email: 'admin@medisync.com', password: 'admin123', name: 'Super Admin' });
    }
    localStorage.setItem('medisync_admins', JSON.stringify(admins));
}

// ========== VITALS MONITORING ==========
function updateVitals() {
    let hr = Math.floor(Math.random() * (85 - 65 + 1) + 65);
    let sys = Math.floor(Math.random() * (130 - 110 + 1) + 110);
    let dia = Math.floor(Math.random() * (85 - 70 + 1) + 70);
    let spo2 = Math.floor(Math.random() * (99 - 95 + 1) + 95);
    let temp = (Math.random() * (37.2 - 36.2) + 36.2).toFixed(1);

    if (document.getElementById('heartRate')) document.getElementById('heartRate').textContent = hr;
    if (document.getElementById('bloodPressure')) document.getElementById('bloodPressure').textContent = `${sys}/${dia}`;
    if (document.getElementById('spo2')) document.getElementById('spo2').textContent = spo2;
    if (document.getElementById('temperature')) document.getElementById('temperature').textContent = temp;

    let ai = document.getElementById('aiInsight');
    if (ai) {
        if (hr > 100) ai.innerHTML = '<i class="fas fa-exclamation-triangle"></i> AI Alert: Elevated heart rate.';
        else if (hr < 60) ai.innerHTML = '<i class="fas fa-info-circle"></i> AI Insight: Heart rate low.';
        else ai.innerHTML = '<i class="fas fa-check-circle"></i> AI Insight: Normal range.';
    }
}

// ========== MODAL FUNCTIONS ==========
function openModal(id) {
    let m = document.getElementById(id);
    if (m) {
        m.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    let m = document.getElementById(id);
    if (m) {
        m.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function closeAllModals() {
    const modalIds = ['roleSelectModal', 'patientSignInModal', 'patientSignUpModal', 'doctorSignInModal', 'doctorSignUpModal', 'patientOtpModal', 'doctorOtpModal', 'consultModal', 'videoModal', 'iotModal', 'adminLoginModal', 'forgotPasswordModal', 'forgotOtpModal', 'resetPasswordModal'];
    modalIds.forEach(id => {
        let m = document.getElementById(id);
        if (m) m.style.display = 'none';
    });
    document.body.style.overflow = 'auto';
    if (localStream) endCall();
}

// ========== NOTIFICATIONS ==========
function showNotification(msg, type = 'info') {
    let n = document.createElement('div');
    n.className = 'notification';
    n.innerHTML = `<span>${msg}</span>`;
    const colors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6' };
    n.style.cssText = `position:fixed; bottom:20px; right:20px; background:${colors[type]}; color:white; padding:12px 20px; border-radius:12px; z-index:10000; font-family:'Inter'; font-size:14px; box-shadow:0 4px 12px rgba(0,0,0,0.15); animation:slideIn 0.3s ease;`;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

// ========== PASSWORD TOGGLE ==========
function togglePassword(fid) {
    let f = document.getElementById(fid);
    if (f) f.setAttribute('type', f.getAttribute('type') === 'password' ? 'text' : 'password');
}

// ========== OTP GENERATION & SENDING ==========
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendOTPToUser(email, mobile) {
    let otp = generateOTP();
    generatedOTP = otp;
    alert(`Your OTP is: ${otp}`);
    showNotification(`OTP sent to ${email}`, 'success');
    return otp;
}

// ========== PATIENT REGISTRATION & LOGIN ==========
function registerPatient(data) {
    let users = JSON.parse(localStorage.getItem('medisync_users') || '[]');
    if (users.find(u => u.email === data.email || u.mobile === data.mobile)) {
        showNotification('User already exists', 'error');
        return false;
    }
    let newUser = { id: Date.now(), role: 'patient', ...data, createdAt: new Date().toISOString() };
    users.push(newUser);
    localStorage.setItem('medisync_users', JSON.stringify(users));
    currentUser = newUser;
    localStorage.setItem('medisync_current_user', JSON.stringify(newUser));
    showNotification('Account created successfully!', 'success');
    updateUIForLoggedInUser();
    return true;
}

function loginPatient(identifier, password) {
    let users = JSON.parse(localStorage.getItem('medisync_users') || '[]');
    let user = users.find(u => u.role === 'patient' && (u.email === identifier || u.mobile === identifier) && u.password === password);
    if (user) {
        currentUser = user;
        localStorage.setItem('medisync_current_user', JSON.stringify(user));
        showNotification(`Welcome ${user.fullName}!`, 'success');
        updateUIForLoggedInUser();
        return true;
    } else {
        showNotification('Invalid credentials', 'error');
        return false;
    }
}

// ========== DOCTOR REGISTRATION & LOGIN (with approval) ==========
function registerDoctorWithApproval(data) {
    let doctors = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
    if (doctors.find(d => d.email === data.email)) {
        showNotification('Doctor already exists', 'error');
        return false;
    }
    let newDoctor = { id: Date.now(), role: 'doctor', status: 'pending', ...data, patients: [], appointments: [], createdAt: new Date().toISOString() };
    doctors.push(newDoctor);
    localStorage.setItem('medisync_doctors', JSON.stringify(doctors));
    showNotification('Registration submitted! Waiting for admin approval.', 'success');
    return true;
}

function loginDoctor(email, password) {
    let doctors = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
    let doctor = doctors.find(d => d.email === email && d.password === password);
    if (!doctor) {
        showNotification('Invalid credentials', 'error');
        return false;
    }
    if (doctor.status === 'pending') {
        showNotification('Account pending approval', 'warning');
        return false;
    }
    if (doctor.status === 'rejected') {
        showNotification('Application rejected', 'error');
        return false;
    }
    currentDoctor = doctor;
    localStorage.setItem('medisync_current_user', JSON.stringify(doctor));
    showNotification(`Welcome Dr. ${doctor.fullName}!`, 'success');
    updateUIForLoggedInUser();
    return true;
}

// ========== UPDATE UI BASED ON LOGIN STATE ==========
function updateUIForLoggedInUser() {
    let nb = document.querySelector('.nav-buttons');
    if (nb && currentUser) {
        nb.innerHTML = `<button class="btn-outline" id="adminPortalBtn"><i class="fas fa-user-shield"></i> Admin</button><div class="user-badge"><div class="user-avatar">${currentUser.fullName.charAt(0)}</div><span class="user-name">${currentUser.fullName.split(' ')[0]}</span><button class="logout-btn" onclick="logoutUser()"><i class="fas fa-sign-out-alt"></i></button></div>`;
        addAdminButtonListener();
    } else if (nb && currentDoctor) {
        nb.innerHTML = `<button class="btn-outline" id="adminPortalBtn"><i class="fas fa-user-shield"></i> Admin</button><div class="user-badge"><div class="user-avatar">👨‍⚕️</div><span class="user-name">Dr. ${currentDoctor.fullName.split(' ')[0]}</span><button class="logout-btn" onclick="logoutUser()"><i class="fas fa-sign-out-alt"></i></button></div>`;
        addAdminButtonListener();
    }
}

function updateUIForLoggedOutUser() {
    let nb = document.querySelector('.nav-buttons');
    if (nb) {
        nb.innerHTML = `<button class="btn-outline" id="adminPortalBtn"><i class="fas fa-user-shield"></i> Admin</button><button class="btn-outline" id="signInBtn">Sign In</button><button class="btn-primary" id="signUpBtn">Create Account</button>`;
        document.getElementById('signInBtn')?.addEventListener('click', () => openModal('roleSelectModal'));
        document.getElementById('signUpBtn')?.addEventListener('click', () => openModal('roleSelectModal'));
        addAdminButtonListener();
    }
}

function logoutUser() {
    currentUser = null;
    currentDoctor = null;
    localStorage.removeItem('medisync_current_user');
    showNotification('Logged out', 'info');
    updateUIForLoggedOutUser();
    if (document.getElementById('adminPanel').style.display === 'block') exitAdminMode();
}

function addAdminButtonListener() {
    let btn = document.getElementById('adminPortalBtn');
    if (btn) {
        btn.removeEventListener('click', btn.clickHandler);
        btn.clickHandler = () => openModal('adminLoginModal');
        btn.addEventListener('click', btn.clickHandler);
    }
}

// ========== UPDATE DOCTORS GRID ON HOMEPAGE ==========
function updateDoctorsGrid() {
    let doctors = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
    let approved = doctors.filter(d => d.status === 'approved');
    let grid = document.getElementById('doctorsGrid');
    if (!grid) return;
    if (approved.length === 0) {
        grid.innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fas fa-user-md" style="font-size:3rem;"></i><p>No doctors available.</p></div>';
        return;
    }
    grid.innerHTML = approved.map(d => `
        <div class="doctor-card">
            <div class="doctor-avatar"><i class="fas fa-user-md"></i></div>
            <h3>Dr. ${d.fullName}</h3>
            <p>${d.specialty}</p>
            <div class="doctor-rating"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><span>4.8</span></div>
            <button class="btn-primary consult-doctor" data-doctor="Dr. ${d.fullName}">Consult →</button>
        </div>
    `).join('');
    document.querySelectorAll('.consult-doctor').forEach(btn => btn.addEventListener('click', () => {
        if (!currentUser && !currentDoctor) {
            showNotification('Please sign in first', 'error');
            openModal('roleSelectModal');
        } else startVideoConsultation(btn.getAttribute('data-doctor'));
    }));
}

// ========== ADMIN FUNCTIONS ==========
function loginAdmin(email, password) {
    let admins = JSON.parse(localStorage.getItem('medisync_admins') || '[]');
    let admin = admins.find(a => a.email === email && a.password === password);
    if (admin) {
        currentAdmin = admin;
        showNotification('Welcome Admin!', 'success');
        openAdminPanel();
        closeModal('adminLoginModal');
        return true;
    } else {
        showNotification('Invalid admin credentials', 'error');
        return false;
    }
}

function openAdminPanel() {
    document.getElementById('mainSiteContent').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAdminStats();
    renderDoctorsList();
    renderPatientsList();
    setupAdminSearch();
    setupAdminTabs();
    document.getElementById('adminLogoutBtn').onclick = exitAdminMode;
    document.querySelectorAll('.admin-stat-card.clickable').forEach(card => {
        card.addEventListener('click', () => {
            let filter = card.getAttribute('data-filter');
            let type = card.getAttribute('data-type');
            if (type === 'doctor') {
                document.querySelector('.admin-tab-btn[data-tab="doctors"]').click();
                if (filter !== 'all') {
                    let searchTerm = filter;
                    document.getElementById('doctorSearchInput').value = searchTerm;
                    renderDoctorsList(searchTerm);
                } else {
                    document.getElementById('doctorSearchInput').value = '';
                    renderDoctorsList();
                }
            } else if (type === 'patient') {
                document.querySelector('.admin-tab-btn[data-tab="patients"]').click();
                document.getElementById('patientSearchInput').value = '';
                renderPatientsList();
            }
        });
    });
}

function exitAdminMode() {
    currentAdmin = null;
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('mainSiteContent').style.display = 'block';
    showNotification('Exited admin mode', 'info');
}

function loadAdminStats() {
    let docs = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
    let pts = JSON.parse(localStorage.getItem('medisync_users') || '[]');
    document.getElementById('adminTotalDoctors').textContent = docs.length;
    document.getElementById('adminPendingDoctors').textContent = docs.filter(d => d.status === 'pending').length;
    document.getElementById('adminApprovedDoctors').textContent = docs.filter(d => d.status === 'approved').length;
    document.getElementById('adminRejectedDoctors').textContent = docs.filter(d => d.status === 'rejected').length;
    document.getElementById('adminTotalPatients').textContent = pts.length;
}

function renderDoctorsList(search = '') {
    let docs = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
    let filtered = docs;
    if (search) {
        let s = search.toLowerCase();
        filtered = docs.filter(d => d.fullName.toLowerCase().includes(s) || d.specialty.toLowerCase().includes(s) || d.email.toLowerCase().includes(s) || d.status.includes(s));
    }
    let container = document.getElementById('adminDoctorsList');
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;">No doctors found</div>';
        return;
    }
    container.innerHTML = filtered.map(d => `
        <div class="admin-doctor-card ${d.status}">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
                <div>
                    <h3>Dr. ${d.fullName}</h3>
                    <p><strong>📧</strong> ${d.email} | <strong>📞</strong> ${d.mobile}</p>
                    <p><strong>🏥</strong> ${d.specialty} | <strong>📜</strong> ${d.licenseNumber}</p>
                    <p><strong>Status:</strong> <span class="status-badge-${d.status}">${d.status.toUpperCase()}</span></p>
                </div>
                <div>
                    ${d.status === 'pending' ? `<button class="btn-approve" onclick="approveDoctor(${d.id})">✓ Approve</button> ` : ''}
                    <button class="btn-delete" onclick="deleteDoctorAccount(${d.id})">🗑 Delete</button>
                    <button class="btn-outline" style="margin-left:0.5rem;" onclick="viewDoctorDetails(${d.id})">👁 View Details</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderPatientsList(search = '') {
    let pts = JSON.parse(localStorage.getItem('medisync_users') || '[]');
    let filtered = pts;
    if (search) {
        let s = search.toLowerCase();
        filtered = pts.filter(p => p.fullName.toLowerCase().includes(s) || p.email.toLowerCase().includes(s) || p.mobile.includes(s));
    }
    let container = document.getElementById('adminPatientsList');
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;">No patients found</div>';
        return;
    }
    container.innerHTML = filtered.map(p => `
        <div class="admin-patient-card">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
                <div>
                    <h3>${p.fullName}</h3>
                    <p><strong>📧</strong> ${p.email} | <strong>📞</strong> ${p.mobile}</p>
                    <p><strong>🎂</strong> Age ${p.age} | ⚥ ${p.gender}</p>
                    <p><strong>Registered:</strong> ${new Date(p.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                    <button class="btn-delete" onclick="deletePatientAccount(${p.id})">🗑 Delete Patient</button>
                    <button class="btn-outline" style="margin-left:0.5rem;" onclick="viewPatientDetails(${p.id})">👁 View Details</button>
                </div>
            </div>
        </div>
    `).join('');
}

function setupAdminSearch() {
    document.getElementById('doctorSearchInput')?.addEventListener('input', e => renderDoctorsList(e.target.value));
    document.getElementById('patientSearchInput')?.addEventListener('input', e => renderPatientsList(e.target.value));
}

function setupAdminTabs() {
    let tabs = document.querySelectorAll('.admin-tab-btn');
    let docsSec = document.getElementById('adminDoctorsSection'), ptsSec = document.getElementById('adminPatientsSection');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.getAttribute('data-tab') === 'doctors') {
                docsSec.classList.add('active');
                ptsSec.classList.remove('active');
            } else {
                ptsSec.classList.add('active');
                docsSec.classList.remove('active');
            }
        });
    });
}

function approveDoctor(id) {
    let docs = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
    let idx = docs.findIndex(d => d.id == id);
    if (idx !== -1) {
        docs[idx].status = 'approved';
        localStorage.setItem('medisync_doctors', JSON.stringify(docs));
        showNotification('Doctor approved', 'success');
        loadAdminStats();
        renderDoctorsList(document.getElementById('doctorSearchInput')?.value || '');
        updateDoctorsGrid();
    }
}

function deleteDoctorAccount(id) {
    if (confirm('⚠️ PERMANENT DELETE? Cannot be undone.')) {
        let docs = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
        docs = docs.filter(d => d.id != id);
        localStorage.setItem('medisync_doctors', JSON.stringify(docs));
        showNotification('Doctor deleted', 'success');
        loadAdminStats();
        renderDoctorsList(document.getElementById('doctorSearchInput')?.value || '');
        updateDoctorsGrid();
    }
}

function deletePatientAccount(id) {
    if (confirm('⚠️ PERMANENT DELETE? Cannot be undone.')) {
        let pts = JSON.parse(localStorage.getItem('medisync_users') || '[]');
        pts = pts.filter(p => p.id != id);
        localStorage.setItem('medisync_users', JSON.stringify(pts));
        showNotification('Patient deleted', 'success');
        loadAdminStats();
        renderPatientsList(document.getElementById('patientSearchInput')?.value || '');
    }
}

function viewDoctorDetails(id) {
    let docs = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
    let doc = docs.find(d => d.id == id);
    if (doc) alert(`Doctor Details:\nName: Dr. ${doc.fullName}\nEmail: ${doc.email}\nMobile: ${doc.mobile}\nSpecialty: ${doc.specialty}\nLicense: ${doc.licenseNumber}\nClinic: ${doc.clinic || 'N/A'}\nStatus: ${doc.status.toUpperCase()}\nRegistered: ${new Date(doc.createdAt).toLocaleString()}`);
}

function viewPatientDetails(id) {
    let pts = JSON.parse(localStorage.getItem('medisync_users') || '[]');
    let pt = pts.find(p => p.id == id);
    if (pt) alert(`Patient Details:\nName: ${pt.fullName}\nEmail: ${pt.email}\nMobile: ${pt.mobile}\nAge: ${pt.age}\nGender: ${pt.gender}\nRegistered: ${new Date(pt.createdAt).toLocaleString()}`);
}

// ========== VIDEO CONSULTATION ==========
async function startVideoConsultation(doctorName) {
    if (!currentUser && !currentDoctor) {
        showNotification('Please sign in first', 'error');
        openModal('roleSelectModal');
        return;
    }
    let modal = document.getElementById('videoModal');
    document.getElementById('remoteDoctorName').textContent = doctorName;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
        modal.style.display = 'flex';
        setTimeout(() => showNotification(`${doctorName} joined the call`, 'success'), 2000);
    } catch (e) {
        alert('Camera/microphone access denied');
        modal.style.display = 'none';
    }
}

function toggleMicrophone() {
    if (localStream) {
        let track = localStream.getAudioTracks()[0];
        if (track) {
            isMicActive = !isMicActive;
            track.enabled = isMicActive;
            let btn = document.getElementById('toggleMicBtn');
            if (btn) btn.innerHTML = isMicActive ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
        }
    }
}

function toggleCamera() {
    if (localStream) {
        let track = localStream.getVideoTracks()[0];
        if (track) {
            isCamActive = !isCamActive;
            track.enabled = isCamActive;
            let btn = document.getElementById('toggleCamBtn');
            if (btn) btn.innerHTML = isCamActive ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
        }
    }
}

function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    closeModal('videoModal');
    showNotification('Consultation ended', 'info');
}

// ========== HOSPITAL SEARCH ==========
function searchHospitals() {
    let term = document.getElementById('hospitalSearch')?.value.toLowerCase() || '';
    let filtered = hospitals.filter(h => h.name.toLowerCase().includes(term) || h.address.toLowerCase().includes(term));
    let res = document.getElementById('hospitalResults');
    if (filtered.length === 0) {
        res.innerHTML = '<p>No hospitals found.</p>';
        return;
    }
    res.innerHTML = filtered.map(h => `
        <div class="hospital-item">
            <h4>🏥 ${h.name}</h4>
            <p>📍 ${h.address}</p>
            <p>📏 ${h.distance}</p>
            <p>⭐ ${h.rating}/5</p>
            <p>📞 ${h.phone}</p>
        </div>
    `).join('');
}

// ========== FILE UPLOAD FOR CONSULTATION ==========
function setupFileUpload() {
    let dz = document.getElementById('fileDropZone'), inp = document.getElementById('medicalReports');
    if (!dz) return;
    dz.addEventListener('click', () => inp.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag-over'); handleFiles(Array.from(e.dataTransfer.files)); });
    inp.addEventListener('change', e => handleFiles(Array.from(e.target.files)));
}

function handleFiles(files) {
    for (let f of files) {
        if (f.size > 5 * 1024 * 1024) {
            showNotification(`${f.name} exceeds 5MB`, 'error');
            continue;
        }
        if (uploadedFiles.length >= 10) {
            showNotification('Max 10 files', 'error');
            break;
        }
        uploadedFiles.push({ id: Date.now() + Math.random(), name: f.name, size: f.size, type: f.type, file: f });
    }
    updateUploadedFilesList();
    document.getElementById('medicalReports').value = '';
}

function updateUploadedFilesList() {
    let cont = document.getElementById('uploadedFilesList');
    if (!cont) return;
    if (uploadedFiles.length === 0) {
        cont.innerHTML = '';
        return;
    }
    cont.innerHTML = uploadedFiles.map(f => `
        <div class="file-item">
            <div class="file-info"><i class="fas ${f.type === 'application/pdf' ? 'fa-file-pdf' : 'fa-file-image'}"></i><span>${f.name} (${(f.size / 1024).toFixed(1)} KB)</span></div>
            <button class="remove-file" onclick="removeFile(${f.id})"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function removeFile(id) {
    uploadedFiles = uploadedFiles.filter(f => f.id !== id);
    updateUploadedFilesList();
    showNotification('File removed', 'info');
}

function saveConsultationWithFiles(data) {
    let cons = JSON.parse(localStorage.getItem('medisync_consultations') || '[]');
    let newCons = { id: Date.now(), ...data, files: uploadedFiles.map(f => ({ id: f.id, name: f.name, size: f.size })), status: 'pending', bookedAt: new Date().toISOString() };
    cons.push(newCons);
    localStorage.setItem('medisync_consultations', JSON.stringify(cons));
    uploadedFiles.forEach(f => {
        let r = new FileReader();
        r.onload = e => localStorage.setItem(`consultation_file_${f.id}`, e.target.result);
        r.readAsDataURL(f.file);
    });
    return newCons;
}

// ========== FORGOT PASSWORD FUNCTIONS (NEW) ==========
function openForgotPasswordModal(role) {
    document.getElementById('forgotRole').value = role;
    openModal('forgotPasswordModal');
}

function requestPasswordReset(identifier, role) {
    let userExists = false;
    if (role === 'patient') {
        let users = JSON.parse(localStorage.getItem('medisync_users') || '[]');
        userExists = users.some(u => u.email === identifier || u.mobile === identifier);
    } else if (role === 'doctor') {
        let doctors = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
        userExists = doctors.some(d => d.email === identifier);
    }
    if (!userExists) {
        showNotification('No account found with this email/phone', 'error');
        return false;
    }
    let otp = generateOTP();
    forgotTempData = { identifier, role, otp };
    alert(`Your password reset OTP is: ${otp}`);
    showNotification(`OTP sent to ${identifier}`, 'success');
    return true;
}

function verifyForgotOtp(enteredOtp) {
    if (!forgotTempData.otp) {
        showNotification('No OTP request found. Please try again.', 'error');
        return false;
    }
    if (enteredOtp === forgotTempData.otp) {
        closeModal('forgotOtpModal');
        openModal('resetPasswordModal');
        return true;
    } else {
        showNotification('Invalid OTP', 'error');
        return false;
    }
}

function updatePassword(identifier, role, newPassword) {
    if (role === 'patient') {
        let users = JSON.parse(localStorage.getItem('medisync_users') || '[]');
        let userIndex = users.findIndex(u => u.email === identifier || u.mobile === identifier);
        if (userIndex !== -1) {
            users[userIndex].password = newPassword;
            localStorage.setItem('medisync_users', JSON.stringify(users));
            showNotification('Password updated successfully. Please login.', 'success');
            return true;
        }
    } else if (role === 'doctor') {
        let doctors = JSON.parse(localStorage.getItem('medisync_doctors') || '[]');
        let doctorIndex = doctors.findIndex(d => d.email === identifier);
        if (doctorIndex !== -1) {
            doctors[doctorIndex].password = newPassword;
            localStorage.setItem('medisync_doctors', JSON.stringify(doctors));
            showNotification('Password updated successfully. Please login.', 'success');
            return true;
        }
    }
    showNotification('Failed to update password', 'error');
    return false;
}

// ========== EVENT LISTENERS ==========
function initializeEventListeners() {
    // Admin login
    document.getElementById('adminLoginForm')?.addEventListener('submit', e => {
        e.preventDefault();
        loginAdmin(document.getElementById('adminEmail').value, document.getElementById('adminPassword').value);
    });

    // Patient sign in
    document.getElementById('patientSignInForm')?.addEventListener('submit', e => {
        e.preventDefault();
        if (loginPatient(document.getElementById('patientLoginIdentifier').value, document.getElementById('patientLoginPassword').value))
            closeModal('patientSignInModal');
    });

    // Patient send OTP
    document.getElementById('patientSendOtpBtn')?.addEventListener('click', () => {
        let fn = document.getElementById('patientFullName')?.value,
            mob = document.getElementById('patientMobile')?.value,
            em = document.getElementById('patientEmail')?.value,
            gen = document.getElementById('patientGender')?.value,
            age = document.getElementById('patientAge')?.value,
            pwd = document.getElementById('patientPassword')?.value,
            cf = document.getElementById('patientConfirmPassword')?.value;
        if (!fn || !mob || !em || !gen || !age || !pwd) {
            showNotification('Fill all fields', 'error');
            return;
        }
        if (pwd !== cf) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        pendingUserData = { fullName: fn, mobile: mob, email: em, gender: gen, age, password: pwd };
        sendOTPToUser(em, mob);
        document.getElementById('patientOtpEmailDisplay').textContent = em;
        closeModal('patientSignUpModal');
        openModal('patientOtpModal');
        for (let i = 1; i <= 6; i++) {
            let inp = document.getElementById(`patientOtp${i}`);
            inp?.addEventListener('input', function (e) {
                if (e.target.value.length === 1 && i < 6) document.getElementById(`patientOtp${i + 1}`)?.focus();
            });
            inp?.addEventListener('keydown', function (e) {
                if (e.key === 'Backspace' && !e.target.value && i > 1) document.getElementById(`patientOtp${i - 1}`)?.focus();
            });
        }
    });

    // Patient verify OTP
    document.getElementById('patientVerifyOtpBtn')?.addEventListener('click', () => {
        let otp = Array.from({ length: 6 }, (_, i) => document.getElementById(`patientOtp${i + 1}`)?.value || '').join('');
        if (otp === generatedOTP && pendingUserData) {
            registerPatient(pendingUserData);
            closeModal('patientOtpModal');
            pendingUserData = null;
            generatedOTP = null;
        } else showNotification('Invalid OTP', 'error');
    });

    // Patient resend OTP
    document.getElementById('patientResendOtpBtn')?.addEventListener('click', () => {
        if (pendingUserData) sendOTPToUser(pendingUserData.email, pendingUserData.mobile);
    });

    // Doctor sign in
    document.getElementById('doctorSignInForm')?.addEventListener('submit', e => {
        e.preventDefault();
        if (loginDoctor(document.getElementById('doctorLoginEmail').value, document.getElementById('doctorLoginPassword').value))
            closeModal('doctorSignInModal');
    });

    // Doctor send OTP
    document.getElementById('doctorSendOtpBtn')?.addEventListener('click', () => {
        let fn = document.getElementById('doctorFullName')?.value,
            em = document.getElementById('doctorEmail')?.value,
            mob = document.getElementById('doctorMobile')?.value,
            spec = document.getElementById('doctorSpecialty')?.value,
            lic = document.getElementById('doctorLicense')?.value,
            clinic = document.getElementById('doctorClinic')?.value,
            pwd = document.getElementById('doctorPassword')?.value,
            cf = document.getElementById('doctorConfirmPassword')?.value;
        if (!fn || !em || !mob || !spec || !lic || !pwd) {
            showNotification('Fill all fields', 'error');
            return;
        }
        if (pwd !== cf) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        pendingDoctorData = { fullName: fn, email: em, mobile: mob, specialty: spec, licenseNumber: lic, clinic, password: pwd };
        sendOTPToUser(em, mob);
        document.getElementById('doctorOtpEmailDisplay').textContent = em;
        closeModal('doctorSignUpModal');
        openModal('doctorOtpModal');
        for (let i = 1; i <= 6; i++) {
            let inp = document.getElementById(`doctorOtp${i}`);
            inp?.addEventListener('input', function (e) {
                if (e.target.value.length === 1 && i < 6) document.getElementById(`doctorOtp${i + 1}`)?.focus();
            });
            inp?.addEventListener('keydown', function (e) {
                if (e.key === 'Backspace' && !e.target.value && i > 1) document.getElementById(`doctorOtp${i - 1}`)?.focus();
            });
        }
    });

    // Doctor verify OTP
    document.getElementById('doctorVerifyOtpBtn')?.addEventListener('click', () => {
        let otp = Array.from({ length: 6 }, (_, i) => document.getElementById(`doctorOtp${i + 1}`)?.value || '').join('');
        if (otp === generatedOTP && pendingDoctorData) {
            registerDoctorWithApproval(pendingDoctorData);
            closeModal('doctorOtpModal');
            pendingDoctorData = null;
            generatedOTP = null;
        } else showNotification('Invalid OTP', 'error');
    });

    // Doctor resend OTP
    document.getElementById('doctorResendOtpBtn')?.addEventListener('click', () => {
        if (pendingDoctorData) sendOTPToUser(pendingDoctorData.email, pendingDoctorData.mobile);
    });

    // Hospital search
    document.getElementById('searchHospitalsBtn')?.addEventListener('click', searchHospitals);

    // Video call controls
    document.getElementById('toggleMicBtn')?.addEventListener('click', toggleMicrophone);
    document.getElementById('toggleCamBtn')?.addEventListener('click', toggleCamera);
    document.getElementById('endCallBtn')?.addEventListener('click', endCall);

    // IoT scan
    document.getElementById('scanDevicesBtn')?.addEventListener('click', () => {
        let st = document.getElementById('deviceStatus');
        if (st) {
            st.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning...';
            setTimeout(() => st.innerHTML = '<i class="fas fa-check-circle"></i> Device connected!', 2000);
        }
    });

    // IoT device options
    document.querySelectorAll('.device-option').forEach(dev => {
        dev.addEventListener('click', function () {
            let name = this.querySelector('span')?.textContent;
            let st = document.getElementById('deviceStatus');
            if (st && name) {
                st.innerHTML = `<i class="fas fa-bluetooth"></i> Connecting to ${name}...`;
                setTimeout(() => st.innerHTML = `<i class="fas fa-check-circle"></i> ${name} connected!`, 1500);
            }
        });
    });

    // Hero buttons
    document.getElementById('watchDemoBtn')?.addEventListener('click', () => showNotification('Demo video coming soon!', 'info'));
    document.getElementById('startConsultBtn')?.addEventListener('click', () => {
        if (!currentUser && !currentDoctor) {
            showNotification('Please sign in first', 'error');
            openModal('roleSelectModal');
        } else openModal('consultModal');
    });
    document.getElementById('finalCtaBtn')?.addEventListener('click', () => openModal('roleSelectModal'));

    // Close modals on clicking close buttons or outside
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => closeAllModals()));
    window.addEventListener('click', e => { if (e.target.classList?.contains('modal')) closeAllModals(); });

    // File upload setup
    setupFileUpload();

    // Consultation form submission
    document.getElementById('consultForm')?.addEventListener('submit', e => {
        e.preventDefault();
        let data = {
            patientName: document.getElementById('consultPatientName').value,
            email: document.getElementById('consultEmail').value,
            phone: document.getElementById('consultPhone').value || 'N/A',
            consultType: document.getElementById('consultType').value,
            dateTime: document.getElementById('consultDateTime').value || 'ASAP',
            symptoms: document.getElementById('symptoms').value || 'None',
            fileCount: uploadedFiles.length
        };
        saveConsultationWithFiles(data);
        showNotification(`Consultation booked! ${uploadedFiles.length} file(s) attached.`, 'success');
        closeModal('consultModal');
        e.target.reset();
        uploadedFiles = [];
        updateUploadedFilesList();
    });

    // ========== FORGOT PASSWORD EVENT LISTENERS ==========
    // Forgot password form submit
    document.getElementById('forgotPasswordForm')?.addEventListener('submit', e => {
        e.preventDefault();
        let identifier = document.getElementById('forgotIdentifier').value;
        let role = document.getElementById('forgotRole').value;
        if (!identifier || !role) {
            showNotification('Please enter your email/phone', 'error');
            return;
        }
        if (requestPasswordReset(identifier, role)) {
            document.getElementById('forgotOtpIdentifierDisplay').textContent = identifier;
            closeModal('forgotPasswordModal');
            openModal('forgotOtpModal');
        }
    });

    // Forgot OTP verification
    document.getElementById('forgotVerifyOtpBtn')?.addEventListener('click', () => {
        let otp = Array.from({ length: 6 }, (_, i) => document.getElementById(`forgotOtp${i + 1}`)?.value || '').join('');
        verifyForgotOtp(otp);
    });

    // Resend OTP for forgot password
    document.getElementById('forgotResendOtpBtn')?.addEventListener('click', () => {
        if (forgotTempData.identifier && forgotTempData.role) {
            let otp = generateOTP();
            forgotTempData.otp = otp;
            alert(`Your new OTP is: ${otp}`);
            showNotification(`New OTP sent to ${forgotTempData.identifier}`, 'success');
        } else {
            showNotification('Session expired. Please start over.', 'error');
            closeModal('forgotOtpModal');
            openModal('forgotPasswordModal');
        }
    });

    // Reset password form submit
    document.getElementById('resetPasswordForm')?.addEventListener('submit', e => {
        e.preventDefault();
        let newPwd = document.getElementById('newPassword').value;
        let confirmPwd = document.getElementById('confirmNewPassword').value;
        if (!newPwd || !confirmPwd) {
            showNotification('Please fill both fields', 'error');
            return;
        }
        if (newPwd !== confirmPwd) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        if (updatePassword(forgotTempData.identifier, forgotTempData.role, newPwd)) {
            closeModal('resetPasswordModal');
            forgotTempData = { identifier: null, role: null, otp: null };
            // Clear OTP inputs for next use
            for (let i = 1; i <= 6; i++) {
                let inp = document.getElementById(`forgotOtp${i}`);
                if (inp) inp.value = '';
            }
            // Open appropriate sign in modal
            if (forgotTempData.role === 'patient') openModal('patientSignInModal');
            else if (forgotTempData.role === 'doctor') openModal('doctorSignInModal');
        }
    });
}

// ========== DOM CONTENT LOADED ==========
document.addEventListener('DOMContentLoaded', () => {
    initAdminAccount();
    updateVitals();
    vitalsInterval = setInterval(updateVitals, 5000);
    updateDoctorsGrid();
    let saved = localStorage.getItem('medisync_current_user');
    if (saved) {
        let user = JSON.parse(saved);
        if (user.role === 'doctor') {
            if (user.status === 'approved') {
                currentDoctor = user;
                updateUIForLoggedInUser();
            } else localStorage.removeItem('medisync_current_user');
        } else {
            currentUser = user;
            updateUIForLoggedInUser();
        }
    } else updateUIForLoggedOutUser();
    initializeEventListeners();
});

// ========== GLOBAL FUNCTIONS (for inline onclick) ==========
window.openModal = openModal;
window.closeModal = closeModal;
window.selectRole = (role) => {
    closeModal('roleSelectModal');
    if (role === 'patient') openModal('patientSignInModal');
    else openModal('doctorSignInModal');
};
window.showPatientSignUp = () => { closeModal('patientSignInModal'); openModal('patientSignUpModal'); };
window.showDoctorSignUp = () => { closeModal('doctorSignInModal'); openModal('doctorSignUpModal'); };
window.togglePassword = togglePassword;
window.logoutUser = logoutUser;
window.startVideoConsultation = startVideoConsultation;
window.toggleMicrophone = toggleMicrophone;
window.toggleCamera = toggleCamera;
window.endCall = endCall;
window.searchHospitals = searchHospitals;
window.approveDoctor = approveDoctor;
window.deleteDoctorAccount = deleteDoctorAccount;
window.deletePatientAccount = deletePatientAccount;
window.viewDoctorDetails = viewDoctorDetails;
window.viewPatientDetails = viewPatientDetails;
window.removeFile = removeFile;
window.openForgotPasswordModal = openForgotPasswordModal;