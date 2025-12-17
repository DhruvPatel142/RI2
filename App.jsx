import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, User, Lock, BookOpen, LogOut, 
  AlertTriangle, CheckCircle, Search, Eye, 
  ChevronLeft, ChevronRight, X, PlusCircle, Save,
  Settings, Key, EyeOff, RefreshCw, Upload, FileText, 
  Trash2, Bell, Activity, Users, Library, Moon, Sun, Flag, HelpCircle, Info,
  MessageSquare, CheckSquare, Download, Power, AlertOctagon, Database,
  ZoomIn, ZoomOut, Loader, Calendar, FileSpreadsheet, Book, Filter
} from 'lucide-react';

// ==========================================
// 0. UTILITIES & CONFIG
// ==========================================

// --- INDEXED DB UTILITY FOR LARGE FILES (100MB+) ---
const LibraryDB = {
  dbName: "SecurePortalLibrary",
  storeName: "books",
  version: 1,

  init: () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(LibraryDB.dbName, LibraryDB.version);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(LibraryDB.storeName)) {
          db.createObjectStore(LibraryDB.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });
  },

  saveFile: async (id, fileBlob) => {
    const db = await LibraryDB.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LibraryDB.storeName, "readwrite");
      const store = tx.objectStore(LibraryDB.storeName);
      store.put(fileBlob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  },

  getFile: async (id) => {
    const db = await LibraryDB.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LibraryDB.storeName, "readonly");
      const store = tx.objectStore(LibraryDB.storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });
  },

  deleteFile: async (id) => {
    const db = await LibraryDB.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LibraryDB.storeName, "readwrite");
      const store = tx.objectStore(LibraryDB.storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    });
  }
};

// --- CUSTOM HOOK FOR CROSS-TAB SYNC ---
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error("Storage full or error", error);
    }
  }, [key, state]);

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue) {
        setState(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [state, setState];
}

// --- DATE VALIDITY CHECKER ---
const isAccessValid = (user) => {
  if (!user.validFrom || !user.validUntil) return true; 
  const now = new Date();
  const start = new Date(user.validFrom);
  const end = new Date(user.validUntil);
  end.setHours(23, 59, 59, 999);
  return now >= start && now <= end;
};

// --- MOCK DATABASE ---
const MARATHI_CONTENT = `
--- LGS PAPER 7 (MARATHI) ---
युनिट १: नगरपालिकांचे वित्त स्रोत, कर, मालमत्ता कर

नगरपालिका ह्या नागरी क्षेत्रांसाठी स्थापित केलेल्या स्थानिक प्राधिकरण आहेत. त्यांची स्थापना नगरांना नागरी सुविधा पुरविणे आणि स्थानिक विकास करणे यासाठी करण्यात आली आहे. ७४व्या घटना दुरुस्तीने त्यांना घटनेची मान्यता प्राप्त झाली आहे.

(This is a digitized text version. To see a real PDF, please upload one in the Admin Panel.)
`;

// UPDATED BOOKS WITH STOCK
const INITIAL_BOOKS = [
  { id: 'b1', title: 'Advanced Agriculture Vol. 1', totalPages: 20, stock: 10 },
  { id: 'b2', title: 'Rural Development Strategies', totalPages: 50, stock: 5 },
  { id: 'b3', title: 'NGO Management Handbook', totalPages: 100, stock: 15 },
  { id: 'b4', title: 'LGS Paper 7 (Marathi): Property Tax Admin', totalPages: 135, stock: 8, content: MARATHI_CONTENT },
];

// UPDATED USERS WITH ACADEMIC YEAR
const INITIAL_USERS = [
  { 
    id: 'NGO-2025-01', 
    name: 'Ravi Kumar', 
    password: '123', 
    totalFee: 10000, 
    paidAmount: 5000, 
    access: ['b1', 'b2', 'b4'],
    validFrom: '2025-01-01',
    validUntil: '2025-12-31',
    physicalIssues: [],
    academicYear: '2025' // NEW FIELD
  },
  { 
    id: 'NGO-2025-02', 
    name: 'Priya Sharma', 
    password: '123', 
    totalFee: 10000, 
    paidAmount: 10000, 
    access: ['b1', 'b3', 'b4'],
    validFrom: '2025-01-01',
    validUntil: '2025-12-31',
    physicalIssues: [],
    academicYear: '2025'
  },
];

const INITIAL_LOGS = [
  { time: '10:00 AM', action: 'System Started', details: 'Server initialized' },
];

const INITIAL_REPORTS = [
  { id: 1, userId: 'NGO-2025-01', context: 'Dashboard', issue: 'Cannot see my exam schedule', status: 'Pending', time: '10:05 AM' }
];

// ==========================================
// 1. MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [view, setView] = useState('login'); 
  const [currentUser, setCurrentUser] = useState(null);
  
  // Data States
  const [users, setUsers] = usePersistentState('portal_users', INITIAL_USERS);
  const [books, setBooks] = usePersistentState('portal_books', INITIAL_BOOKS);
  const [logs, setLogs] = usePersistentState('portal_logs', INITIAL_LOGS);
  const [reports, setReports] = usePersistentState('portal_reports', INITIAL_REPORTS);
  
  const [settings, setSettings] = usePersistentState('portal_settings', {
    announcement: 'Welcome to the new academic session.',
    watermarkText: 'CONFIDENTIAL - DO NOT SHARE',
    adminNote: '',
    maintenanceMode: false
  });

  const [darkMode, setDarkMode] = useState(false);

  // Helper Wrappers
  const addLog = (action, details) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLogs(prev => [{ time, action, details }, ...prev]);
  };

  const handleReportIssue = (userId, context, issue) => {
    const newReport = {
      id: Date.now(),
      userId,
      context,
      issue,
      status: 'Pending',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setReports(prev => [newReport, ...prev]);
    addLog('User Report', `New report from ${userId}`);
    console.log("Report submitted successfully!");
  };

  const toggleReportStatus = (reportId) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: r.status === 'Pending' ? 'Resolved' : 'Pending' } : r));
  };

  // --- LOGIN LOGIC ---
  const handleLogin = (id, pass) => {
    if (id === 'admin' && pass === 'admin') {
      setView('admin');
      return;
    }

    if (settings.maintenanceMode) {
      alert("System is currently under maintenance. Please contact Admin.");
      return;
    }

    const user = users.find(u => u.id === id && u.password === pass);
    if (user) {
      setCurrentUser(user);
      setView('student');
      addLog('User Login', `${user.name} (${user.id}) logged in`);
    } else {
      alert('Invalid Credentials! (Try: NGO-2025-01 / 123)');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setView('login');
  };

  const changePassword = (userId, newPass) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPass } : u));
    addLog('Password Change', `User ${userId} updated their password`);
    alert("Password updated successfully!");
  };

  const resetPassword = (userId, newPass) => {
    const userExists = users.some(u => u.id === userId);
    if (userExists) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPass } : u));
      addLog('Password Reset', `Password reset for ${userId}`);
      return true;
    }
    return false;
  };

  return (
    <div className={`min-h-screen font-sans select-none transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-800'}`}>
      {view === 'login' && <LoginScreen onLogin={handleLogin} onResetPassword={resetPassword} maintenanceMode={settings.maintenanceMode} />}
      
      {view === 'admin' && 
        <AdminPanel 
          users={users} setUsers={setUsers} 
          books={books} setBooks={setBooks} 
          logs={logs} addLog={addLog} setLogs={setLogs}
          reports={reports} toggleReportStatus={toggleReportStatus}
          settings={settings} setSettings={setSettings}
          onLogout={logout} 
        />
      }
      
      {view === 'student' && 
        <StudentPortal 
          user={currentUser} 
          allBooks={books} 
          settings={settings}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onLogout={logout} 
          onChangePassword={changePassword}
          onReportIssue={handleReportIssue}
        />
      }
    </div>
  );
}

// ==========================================
// 2. LOGIN SCREEN
// ==========================================
function LoginScreen({ onLogin, onResetPassword, maintenanceMode }) {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [newResetPass, setNewResetPass] = useState('');

  const handleResetSubmit = () => {
    if (!id || !newResetPass) {
      alert("Please enter ID and new password.");
      return;
    }
    const success = onResetPassword(id, newResetPass);
    if (success) {
      alert("Password reset successful!");
      setIsResetMode(false);
      setPass(''); 
      setNewResetPass('');
    } else {
      alert("User ID not found.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 text-9xl text-white rotate-12"><Lock/></div>
        <div className="absolute bottom-10 right-10 text-9xl text-white -rotate-12"><Shield/></div>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md relative z-10 border border-slate-700 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="mx-auto bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center text-white mb-4 shadow-lg">
            {isResetMode ? <RefreshCw className="w-8 h-8" /> : <Shield className="w-8 h-8" />}
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isResetMode ? "Reset Password" : "Secure Learning Portal"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isResetMode ? "Verify ID to create new password" : "Authorized Access Only"}
          </p>
        </div>

        {maintenanceMode && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded animate-pulse">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-bold">
                  System Maintenance Enabled
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Student login is disabled. Admins can still login.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {isResetMode ? (
          <div className="space-y-4">
             <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Enter User ID</label>
              <input type="text" value={id} onChange={e => setId(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" placeholder="e.g. NGO-2025-01" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Password</label>
              <input type="password" value={newResetPass} onChange={e => setNewResetPass(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" placeholder="Enter new password" />
            </div>
            <button onClick={handleResetSubmit} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700">Update Password</button>
            <button onClick={() => setIsResetMode(false)} className="w-full text-slate-500 text-sm py-2 hover:text-blue-600 font-medium">Back to Login</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">User ID / Admin</label>
              <input type="text" value={id} onChange={e => setId(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" placeholder="e.g. NGO-2025-01" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none" placeholder="••••••" />
            </div>
            <div className="flex justify-end">
              <button onClick={() => setIsResetMode(true)} className="text-xs text-blue-600 font-bold hover:underline">Forgot Password?</button>
            </div>
            <button onClick={() => onLogin(id, pass)} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg transform active:scale-95 transition-all">
              Authenticate & Login
            </button>
            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">Demo Credentials</span>
              <div className="text-xs text-slate-500 mt-2 space-y-1">
                <p>Admin: <span className="font-mono bg-slate-100 px-1">admin</span> / <span className="font-mono bg-slate-100 px-1">admin</span></p>
                <p>Student: <span className="font-mono bg-slate-100 px-1">NGO-2025-01</span> / <span className="font-mono bg-slate-100 px-1">123</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. ADMIN PANEL (UPDATED WITH PHYSICAL LIBRARY)
// ==========================================
function AdminPanel({ 
  users, setUsers, 
  books, setBooks, 
  logs, addLog, setLogs,
  reports, toggleReportStatus,
  settings, setSettings,
  onLogout 
}) {
  const [activeTab, setActiveTab] = useState('physical_library');
  
  // USER FILTER STATE
  const [viewYear, setViewYear] = useState(new Date().getFullYear().toString());

  // REPORT FILTER STATE
  const [reportType, setReportType] = useState('monthly'); // 'monthly' | 'yearly'
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString()); // YYYY

  const [newUser, setNewUser] = useState({ 
    id: '', name: '', password: '123', totalFee: 10000,
    validFrom: '2025-01-01', validUntil: '2025-12-31',
    academicYear: new Date().getFullYear().toString()
  });
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookPages, setNewBookPages] = useState('');
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- ACTIONS ---
  const updateUserFee = (userId, value) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, paidAmount: Number(value) } : u));
    addLog('Fee Update', `Updated fee for ${userId} to ${value}`);
  };

  const toggleAccess = (userId, bookId) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const hasAccess = u.access.includes(bookId);
      return { ...u, access: hasAccess ? u.access.filter(id => id !== bookId) : [...u.access, bookId] };
    }));
  };

  const addUser = () => {
    if (!newUser.id || !newUser.name) return alert("Please enter ID and Name");
    if (users.some(u => u.id === newUser.id)) return alert("User ID already exists");
    setUsers(prev => [...prev, { ...newUser, paidAmount: 0, access: [], physicalIssues: [] }]);
    addLog('Create User', `Created ${newUser.name} (${newUser.id})`);
    setNewUser({ 
      id: '', name: '', password: '123', totalFee: 10000, 
      validFrom: '2025-01-01', validUntil: '2025-12-31',
      academicYear: new Date().getFullYear().toString()
    });
  };

  const deleteUser = (userId) => {
    if (window.confirm(`Delete user ${userId}?`)) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      addLog('Delete User', `Deleted user ${userId}`);
    }
  };

  const adminResetPass = (userId) => {
    const newPass = prompt("Enter new password:", "123456");
    if (newPass) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, password: newPass } : u));
      addLog('Admin Password Reset', `Reset password for ${userId}`);
    }
  };

  // --- NEW: PHYSICAL LIBRARY ACTIONS ---
  const issuePhysicalBook = (userId, bookId) => {
    const book = books.find(b => b.id === bookId);
    
    // Check Stock
    if (book.stock < 1) return alert("Out of Stock!");

    // Check Fee (Warning)
    const user = users.find(u => u.id === userId);
    if (user.paidAmount < user.totalFee * 0.5) {
      if(!confirm("Student has not paid 50% fees. Issue anyway?")) return;
    }

    const issueDate = new Date().toISOString().split('T')[0];
    
    // Decrease Stock
    setBooks(prev => prev.map(b => b.id === bookId ? {...b, stock: b.stock - 1} : b));
    
    // Add to User's "Physical Issues"
    setUsers(prev => prev.map(u => u.id === userId ? {
      ...u, 
      physicalIssues: [...(u.physicalIssues || []), { bookId, title: book.title, date: issueDate }]
    } : u));

    addLog('Physical Issue', `Issued "${book.title}" to ${userId}`);
  };

  const returnPhysicalBook = (userId, bookId) => {
    if(!confirm("Confirm return of book?")) return;

    // Increase Stock
    setBooks(prev => prev.map(b => b.id === bookId ? {...b, stock: b.stock + 1} : b));

    // Remove from User
    setUsers(prev => prev.map(u => u.id === userId ? {
      ...u, 
      physicalIssues: u.physicalIssues.filter(i => i.bookId !== bookId)
    } : u));

    addLog('Physical Return', `Returned book from ${userId}`);
  };

  const downloadReport = () => {
    const headers = ["Student ID", "Student Name", "Academic Year", "Book Title", "Issue Date", "Status"];
    const rows = [];

    // Filter Logic
    let filterMonth = -1;
    let filterYear = -1;

    if (reportType === 'monthly') {
      const d = new Date(reportDate);
      filterMonth = d.getMonth();
      filterYear = d.getFullYear();
    } else {
      filterYear = parseInt(reportYear);
    }

    users.forEach(u => {
      if (u.physicalIssues && u.physicalIssues.length > 0) {
        u.physicalIssues.forEach(issue => {
          const issueDate = new Date(issue.date);
          let match = false;

          if (reportType === 'monthly') {
             match = issueDate.getMonth() === filterMonth && issueDate.getFullYear() === filterYear;
          } else {
             match = issueDate.getFullYear() === filterYear;
          }

          if (match) {
             rows.push([u.id, u.name, u.academicYear || 'N/A', issue.title, issue.date, "ISSUED"]);
          }
        });
      }
    });

    if (rows.length === 0) {
      alert("No records found for selected period.");
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = reportType === 'monthly' ? `Library_Report_${reportDate}.csv` : `Library_Report_${reportYear}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    addLog('Report', `Downloaded ${reportType} report`);
  };

  // --- LIBRARY UPLOAD ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setNewBookTitle(file.name.replace('.pdf', ''));
  };

  const addBook = async () => {
    if (!newBookTitle || !newBookPages) return alert("Please enter details.");
    
    const file = fileInputRef.current?.files[0];
    const newId = `b${Date.now()}`;

    if (file) {
      if (file.size > 100 * 1024 * 1024) { 
        alert("File too large. Max 100MB allowed.");
        return;
      }
      setIsUploading(true);
      try {
        await LibraryDB.saveFile(newId, file); 
        setBooks(prev => [...prev, { 
          id: newId, title: newBookTitle, totalPages: Number(newBookPages), stock: 5, hasFile: true 
        }]);
        addLog('Add Book', `Uploaded "${newBookTitle}"`);
      } catch (err) {
        alert("Error saving file: " + err.message);
      }
      setIsUploading(false);
    } else {
      setBooks(prev => [...prev, { id: newId, title: newBookTitle, totalPages: Number(newBookPages), stock: 5 }]);
      addLog('Add Book', `Added "${newBookTitle}" (No File)`);
    }

    setNewBookTitle('');
    setNewBookPages('');
    if (fileInputRef.current) fileInputRef.current.value = "";
    alert("Book added successfully!");
  };

  const deleteBook = async (bookId, title) => {
    if (window.confirm(`Delete book "${title}"?`)) {
      await LibraryDB.deleteFile(bookId); 
      setBooks(prev => prev.filter(b => b.id !== bookId));
      setUsers(prev => prev.map(u => ({...u, access: u.access.filter(aid => aid !== bookId)})));
      addLog('Delete Book', `Deleted book "${title}"`);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    addLog('System Setting', `Updated ${key}`);
  };

  const updateAnnouncement = () => {
    const msg = prompt("Enter new announcement:", settings.announcement);
    if (msg !== null) updateSetting('announcement', msg);
  };

  const clearLogs = () => {
    if (window.confirm("Clear all logs?")) setLogs([]);
  };

  // Filter Users by Academic Year
  const filteredUsers = users.filter(u => u.academicYear === viewYear);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <nav className="bg-slate-800 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <h2 className="font-bold text-lg flex items-center"><Shield className="mr-2 text-blue-400"/> Admin Console</h2>
            <div className="flex space-x-1">
              <button onClick={() => setActiveTab('physical_library')} className={`px-3 py-2 rounded text-sm font-medium ${activeTab === 'physical_library' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Physical Counter</button>
              <button onClick={() => setActiveTab('users')} className={`px-3 py-2 rounded text-sm font-medium ${activeTab === 'users' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Users & Fees</button>
              <button onClick={() => setActiveTab('library')} className={`px-3 py-2 rounded text-sm font-medium ${activeTab === 'library' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Digital Library</button>
              <button onClick={() => setActiveTab('reports')} className={`px-3 py-2 rounded text-sm font-medium ${activeTab === 'reports' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Reports</button>
              <button onClick={() => setActiveTab('system')} className={`px-3 py-2 rounded text-sm font-medium ${activeTab === 'system' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>System</button>
            </div>
            <button onClick={onLogout} className="text-xs bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold">LOGOUT</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8 w-full">
        
        {/* --- PHYSICAL LIBRARY COUNTER TAB --- */}
        {activeTab === 'physical_library' && (
          <div className="space-y-6 animate-in fade-in">
            
            {/* 1. STOCK OVERVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                 <h3 className="font-bold text-lg mb-4 flex items-center"><Book className="w-5 h-5 mr-2 text-blue-600"/> Current Stock Status</h3>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {books.map(b => (
                      <div key={b.id} className={`p-3 rounded-lg border ${b.stock < 3 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                        <div className="text-xs font-bold text-slate-500 truncate" title={b.title}>{b.title}</div>
                        <div className={`text-2xl font-bold ${b.stock < 3 ? 'text-red-600' : 'text-green-600'}`}>
                          {b.stock} <span className="text-[10px] text-slate-400 uppercase">Left</span>
                        </div>
                      </div>
                    ))}
                 </div>
               </div>

               {/* 2. EXCEL DOWNLOAD BUTTON WITH FILTERS */}
               <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg flex flex-col justify-between items-start">
                  <div className="w-full">
                    <h3 className="font-bold text-lg">Librarian Report</h3>
                    <p className="text-green-100 text-sm mt-1 mb-4">Export issue activity.</p>
                    
                    <div className="space-y-2">
                       <div>
                         <label className="text-[10px] font-bold uppercase text-green-200">Report Type</label>
                         <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full text-slate-800 text-xs p-1 rounded">
                           <option value="monthly">Monthly</option>
                           <option value="yearly">Yearly</option>
                         </select>
                       </div>
                       
                       {reportType === 'monthly' ? (
                         <div>
                           <label className="text-[10px] font-bold uppercase text-green-200">Select Month</label>
                           <input type="month" value={reportDate} onChange={e => setReportDate(e.target.value)} className="w-full text-slate-800 text-xs p-1 rounded" />
                         </div>
                       ) : (
                         <div>
                           <label className="text-[10px] font-bold uppercase text-green-200">Select Year</label>
                           <input type="number" value={reportYear} onChange={e => setReportYear(e.target.value)} className="w-full text-slate-800 text-xs p-1 rounded" placeholder="YYYY" />
                         </div>
                       )}
                    </div>
                  </div>
                  
                  <button onClick={downloadReport} className="mt-4 bg-white text-green-700 w-full py-2 rounded font-bold hover:bg-green-50 flex items-center justify-center">
                    <FileSpreadsheet className="w-4 h-4 mr-2"/> Download
                  </button>
               </div>
            </div>

            {/* 3. ISSUE / RETURN COUNTER */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                 <h3 className="font-bold text-slate-800">Issue Counter</h3>
               </div>
               <table className="w-full text-left">
                <thead className="text-[10px] uppercase font-bold text-slate-500 border-b">
                  <tr>
                    <th className="p-4">Student</th>
                    <th className="p-4">Currently Holding</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-bold">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.id} <span className="text-slate-300">|</span> Batch {u.academicYear || 'N/A'}</div>
                         <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${u.paidAmount >= u.totalFee ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                             {Math.round((u.paidAmount / u.totalFee) * 100)}% Fees Paid
                          </div>
                      </td>
                      <td className="p-4">
                        {u.physicalIssues && u.physicalIssues.length > 0 ? (
                           <div className="space-y-2">
                             {u.physicalIssues.map((issue, idx) => (
                               <div key={idx} className="flex items-center justify-between bg-yellow-50 p-2 rounded border border-yellow-200 text-xs">
                                  <span>{issue.title} <span className="text-slate-400">({issue.date})</span></span>
                                  <button onClick={() => returnPhysicalBook(u.id, issue.bookId)} className="text-red-600 hover:underline font-bold ml-2">Return</button>
                               </div>
                             ))}
                           </div>
                        ) : <span className="text-slate-400 italic">No books issued</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                           <select id={`select-${u.id}`} className="border p-2 rounded text-xs w-48 truncate">
                              <option value="">Select book to issue...</option>
                              {books.filter(b => b.stock > 0).map(b => (
                                <option key={b.id} value={b.id}>{b.title} ({b.stock} left)</option>
                              ))}
                           </select>
                           <button 
                             onClick={() => {
                               const select = document.getElementById(`select-${u.id}`);
                               if(select.value) {
                                 issuePhysicalBook(u.id, select.value);
                                 select.value = "";
                               }
                             }}
                             className="bg-blue-600 text-white px-3 py-2 rounded text-xs font-bold hover:bg-blue-700"
                           >
                             Issue
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in">
            {/* CREATE USER BOX */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold mb-4 text-slate-800 flex items-center border-b pb-2">
                <PlusCircle className="w-5 h-5 mr-2 text-green-600" /> Register New Student
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">ID</label>
                  <input type="text" value={newUser.id} onChange={e => setNewUser({...newUser, id: e.target.value})} className="w-full border p-2 rounded text-sm mt-1" placeholder="NGO-XX" />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Name</label>
                  <input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full border p-2 rounded text-sm mt-1" placeholder="Full Name" />
                </div>
                <div className="md:col-span-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Batch Year</label>
                  <input type="text" value={newUser.academicYear} onChange={e => setNewUser({...newUser, academicYear: e.target.value})} className="w-full border p-2 rounded text-sm mt-1" placeholder="2025" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Total Fee</label>
                  <input type="number" value={newUser.totalFee} onChange={e => setNewUser({...newUser, totalFee: Number(e.target.value)})} className="w-full border p-2 rounded text-sm mt-1" />
                </div>
                <div className="md:col-span-3">
                  <button onClick={addUser} className="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700 flex items-center justify-center text-sm shadow-sm">
                    <Save className="w-4 h-4 mr-2" /> Save User
                  </button>
                </div>
              </div>
            </div>

            {/* FILTER & LIST */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="font-bold text-slate-800">Student Database</h3>
                  <div className="flex items-center space-x-2">
                     <Filter className="w-4 h-4 text-slate-400" />
                     <span className="text-xs font-bold text-slate-500">Filter Year:</span>
                     <select value={viewYear} onChange={e => setViewYear(e.target.value)} className="text-xs border rounded p-1">
                        <option value="2024">2024</option>
                        <option value="2025">2025</option>
                        <option value="2026">2026</option>
                        <option value="2027">2027</option>
                     </select>
                  </div>
               </div>
              <table className="w-full text-left">
                <thead className="bg-white text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-4 w-1/4">Details</th>
                    <th className="p-4 w-1/4">Fee Status</th>
                    <th className="p-4 w-1/3">Book Access</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUsers.length > 0 ? filteredUsers.map(user => {
                    const percent = Math.round((user.paidAmount / user.totalFee) * 100);
                    return (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-4 align-top">
                          <div className="font-bold text-slate-800">{user.name}</div>
                          <div className="font-mono text-slate-500 text-xs">{user.id}</div>
                          <div className="text-[10px] bg-slate-100 text-slate-500 inline-block px-1 rounded mt-1 font-bold">Batch: {user.academicYear}</div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex items-center space-x-2 mb-1">
                             <span className="font-bold text-slate-400">₹</span>
                             <input type="number" value={user.paidAmount} onChange={(e) => updateUserFee(user.id, e.target.value)} className="w-24 border border-slate-300 p-1 rounded font-bold text-slate-800 focus:border-blue-500 outline-none text-right" />
                             <span className="text-xs text-slate-400">/ {user.totalFee}</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden max-w-[150px]">
                             <div className={`h-full ${percent === 100 ? 'bg-green-500' : 'bg-orange-500'}`} style={{width: `${percent}%`}}></div>
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto pr-2">
                             {books.map(book => (
                               <label key={book.id} className="flex items-center space-x-2 cursor-pointer">
                                 <input type="checkbox" checked={user.access.includes(book.id)} onChange={() => toggleAccess(user.id, book.id)} className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4" />
                                 <span className="text-xs text-slate-600 truncate max-w-[150px]" title={book.title}>{book.title}</span>
                               </label>
                             ))}
                          </div>
                        </td>
                        <td className="p-4 align-top text-right space-y-2">
                          <button onClick={() => adminResetPass(user.id)} className="block w-full text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded">Reset Pass</button>
                          <button onClick={() => deleteUser(user.id)} className="block w-full text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded border border-red-100">Delete</button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-slate-400 italic">No students found for Academic Year {viewYear}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- DIGITAL LIBRARY TAB (RESTORED) --- */}
        {activeTab === 'library' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold mb-4 text-slate-800 flex items-center border-b pb-2">
                <Upload className="w-5 h-5 mr-2 text-blue-600" /> Upload New Book (PDF)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="md:col-span-5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Select PDF (Max 100MB)</label>
                  <input type="file" accept="application/pdf" ref={fileInputRef} onChange={handleFileSelect} className="w-full text-xs" />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Title</label>
                  <input type="text" value={newBookTitle} onChange={e => setNewBookTitle(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Book Title" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Pages</label>
                  <input type="number" value={newBookPages} onChange={e => setNewBookPages(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="100" />
                </div>
                <div className="md:col-span-1">
                  <button onClick={addBook} disabled={isUploading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 flex justify-center disabled:opacity-50">
                    {isUploading ? <RefreshCw className="w-5 h-5 animate-spin"/> : <PlusCircle className="w-5 h-5"/>}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="divide-y divide-slate-100">
                    {books.map(book => {
                        const issuers = users.filter(u => u.access.includes(book.id));
                        return (
                        <div key={book.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 group">
                            <div className="flex items-center space-x-3 mb-4 md:mb-0">
                                <div className="bg-blue-100 p-2 rounded text-blue-600"><FileText className="w-5 h-5"/></div>
                                <div>
                                    <div className="font-bold text-slate-800">{book.title}</div>
                                    <div className="text-xs text-slate-500">{book.totalPages} Pages • {book.hasFile ? <span className="text-green-600 font-bold">PDF Uploaded</span> : 'Digital Text'}</div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-6">
                                <div className="text-right">
                                    <div className="text-[10px] font-bold uppercase text-slate-400">Digital Access</div>
                                    <div className="font-bold text-slate-700 flex items-center justify-end group cursor-help relative">
                                        <Users className="w-4 h-4 mr-1 text-blue-500"/> {issuers.length} Students
                                        <div className="absolute bottom-full mb-2 right-0 w-48 bg-slate-800 text-white text-xs rounded p-2 hidden group-hover:block z-50 shadow-xl">
                                            <div className="font-bold border-b border-slate-600 pb-1 mb-1">Student List:</div>
                                            {issuers.length > 0 ? (
                                                <ul className="max-h-32 overflow-y-auto">
                                                {issuers.map(u => <li key={u.id} className="truncate">• {u.name}</li>)}
                                                </ul>
                                            ) : <span className="italic text-slate-400">Not issued to anyone</span>}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => deleteBook(book.id, book.title)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition">
                                <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">User Issue Reports</h3>
                <span className="text-xs bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded font-bold">
                  {reports.filter(r => r.status === 'Pending').length} Pending
                </span>
              </div>
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="p-4">Time</th>
                    <th className="p-4">User</th>
                    <th className="p-4">Context</th>
                    <th className="p-4">Issue Description</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {reports.map((report) => (
                    <tr key={report.id} className={report.status === 'Pending' ? 'bg-orange-50/50' : 'bg-white'}>
                      <td className="p-4 text-slate-500 whitespace-nowrap">{report.time}</td>
                      <td className="p-4 font-medium text-slate-800">{report.userId}</td>
                      <td className="p-4 text-slate-600"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{report.context}</span></td>
                      <td className="p-4 text-slate-800 max-w-xs">{report.issue}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${report.status === 'Resolved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => toggleReportStatus(report.id)}
                          className={`text-xs px-3 py-1 rounded border transition ${report.status === 'Pending' ? 'bg-green-600 text-white border-green-600 hover:bg-green-700' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                        >
                          {report.status === 'Pending' ? 'Mark Resolved' : 'Re-open'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-400 italic">No reports submitted yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`rounded-xl shadow-sm border p-6 flex flex-col justify-between ${settings.maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center mb-2">
                    <AlertOctagon className="w-5 h-5 mr-2 text-red-500" /> Maintenance Mode
                  </h3>
                  <p className="text-sm text-slate-600">
                    {settings.maintenanceMode ? "System is LOCKED. Students cannot login." : "System is LIVE. Students can access portal."}
                  </p>
                </div>
                <button 
                  onClick={() => updateSetting('maintenanceMode', !settings.maintenanceMode)}
                  className={`mt-4 w-full py-2 rounded text-sm font-bold transition ${settings.maintenanceMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {settings.maintenanceMode ? "Disable Maintenance Mode" : "Enable Maintenance Mode"}
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center mb-2">
                    <Settings className="w-5 h-5 mr-2 text-slate-500" /> Data Management
                  </h3>
                  <p className="text-sm text-slate-600">Download backup or clear audit trails.</p>
                </div>
                <div className="flex space-x-2 mt-4">
                  <button onClick={() => alert("Backup downloaded (simulated)")} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded text-sm font-bold hover:bg-blue-100 flex items-center justify-center">
                    <Download className="w-4 h-4 mr-2" /> Backup
                  </button>
                  <button onClick={clearLogs} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded text-sm font-bold hover:bg-slate-200">
                    Clear Logs
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                  <Bell className="w-5 h-5 mr-2 text-orange-500" /> Global Announcement
                </h3>
                <button onClick={updateAnnouncement} className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded font-bold hover:bg-blue-100">Edit</button>
              </div>
              <div className="bg-orange-50 p-4 rounded border border-orange-100 text-orange-800 text-sm">
                "{settings.announcement}"
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center mb-4 border-b pb-2">
                <Eye className="w-5 h-5 mr-2 text-purple-600" /> Viewer Settings (Security & Overlay)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Watermark Text</label>
                  <input type="text" value={settings.watermarkText} onChange={e => updateSetting('watermarkText', e.target.value)} className="w-full border p-2 rounded text-sm"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Admin Sticky Note</label>
                  <input type="text" value={settings.adminNote} onChange={e => updateSetting('adminNote', e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="e.g. Read Chapter 4"/>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-800">System Audit Log</h3>
              </div>
              <div className="max-h-96 overflow-y-auto bg-slate-900 text-slate-300 font-mono text-xs p-4 space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex space-x-3 border-b border-slate-800 pb-1 mb-1 last:border-0">
                    <span className="text-slate-500 shrink-0">{log.time}</span>
                    <span className="text-blue-400 font-bold shrink-0 w-32">{log.action}</span>
                    <span className="text-slate-300">{log.details}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4. STUDENT PORTAL
// ==========================================
function StudentPortal({ user, allBooks, settings, darkMode, setDarkMode, onLogout, onChangePassword, onReportIssue }) {
  const [activeBook, setActiveBook] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBooks = allBooks.filter(book => 
    user.access.includes(book.id) && 
    book.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
      {/* Header */}
      <header className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b shadow-sm sticky top-0 z-30 transition-colors`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-1.5 rounded text-white"><BookOpen className="w-5 h-5" /></div>
            <span className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-slate-800'}`}>My Library</span>
          </div>
          
          <div className="flex items-center space-x-4">
             <button
               onClick={() => setShowHelp(true)}
               className="hidden md:flex items-center space-x-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100 transition"
             >
               <HelpCircle className="w-3 h-3" /> <span>HELP</span>
             </button>

             <button 
                onClick={() => {
                  const issue = prompt("Please describe the issue you are facing:");
                  if (issue) onReportIssue(user.id, "Dashboard", issue);
                }} 
                className="hidden md:flex items-center space-x-1 text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded hover:bg-red-100 transition"
             >
                <Flag className="w-3 h-3" /> <span>REPORT</span>
             </button>

             <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full transition ${darkMode ? 'bg-slate-700 text-yellow-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {darkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
             </button>

             <div className="h-6 w-px bg-slate-300 mx-2"></div>

             <div className="text-right hidden sm:block leading-tight">
               <div className={`text-[10px] font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Student ID</div>
               <div className={`text-sm font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>{user.id}</div>
             </div>
             
             <div className="relative">
                <button onClick={() => setShowProfile(!showProfile)} className={`p-2 rounded-full transition ${darkMode ? 'hover:bg-slate-700 text-slate-300' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <User className="w-5 h-5" />
                </button>
                {showProfile && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-200 text-slate-800">
                    <h4 className="font-bold mb-2 border-b pb-2 flex items-center"><Settings className="w-4 h-4 mr-2"/> Account Settings</h4>
                    <div className="space-y-3">
                       <div>
                         <label className="text-[10px] uppercase font-bold text-slate-500">New Password</label>
                         <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full border p-2 rounded text-sm mt-1" placeholder="Enter new password" />
                       </div>
                       <button onClick={() => { onChangePassword(user.id, newPass); setNewPass(''); setShowProfile(false); }} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-700">Update Password</button>
                       <button onClick={onLogout} className="w-full border border-red-200 text-red-600 text-xs font-bold py-2 rounded hover:bg-red-50 flex items-center justify-center"><LogOut className="w-3 h-3 mr-2"/> Sign Out</button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 py-8">
        {showHelp && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className={`${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'} max-w-xl w-full mx-4 rounded-xl shadow-2xl border ${darkMode ? 'border-slate-700' : 'border-slate-200'} p-6 relative`}>
              <button
                onClick={() => setShowHelp(false)}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-lg font-bold mb-2 flex items-center">
                <Info className="w-4 h-4 mr-2 text-blue-500" /> How to use this portal
              </h2>
              <p className="text-sm mb-4">
                This help is fully text-based to protect your privacy. Support will never ask you to send screenshots or screen recordings from this portal.
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <h3 className="font-semibold">1. Login</h3>
                  <p>Use your Student ID and password on the login page. If you forget your password, use &quot;Forgot Password&quot; or contact the admin with your ID only.</p>
                </div>
                <div>
                  <h3 className="font-semibold">2. Reading books</h3>
                  <p>Go to &quot;Assigned Books&quot; and click a title to open it. Pages unlock based on your fee payment status. Use the arrows at the bottom to change pages.</p>
                </div>
                <div>
                  <h3 className="font-semibold">3. Reporting an issue (without screenshots)</h3>
                  <p>Use the red &quot;REPORT&quot; button on the dashboard or the flag button inside the reader. Describe the issue in words (page number, book name, and what went wrong). Do not send photos, screenshots or recordings.</p>
                </div>
                <div>
                  <h3 className="font-semibold">4. Changing password</h3>
                  <p>Click your profile icon on the top-right, enter a new password, and click &quot;Update Password&quot;.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeBook ? (
          <SecureReader 
            book={activeBook} 
            user={user} 
            settings={settings}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onReportIssue={onReportIssue}
            onClose={() => setActiveBook(null)} 
          />
        ) : (
          <BookList user={user} allBooks={allBooks} announcement={settings.announcement} filteredBooks={filteredBooks} searchTerm={searchTerm} setSearchTerm={setSearchTerm} darkMode={darkMode} onOpen={setActiveBook} />
        )}
      </main>
    </div>
  );
}

function BookList({ user, announcement, filteredBooks, searchTerm, setSearchTerm, darkMode, onOpen }) {
  const percentPaid = Math.round((user.paidAmount / user.totalFee) * 100);
  
  // DATE VALIDITY CHECK
  const validAccess = isAccessValid(user);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {announcement && (
        <div className={`border-l-4 p-4 rounded shadow-sm flex items-start ${darkMode ? 'bg-orange-900/20 border-orange-500 text-orange-200' : 'bg-orange-50 border-orange-500 text-orange-900'}`}>
          <Bell className="w-5 h-5 text-orange-500 mr-3 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-bold text-sm uppercase mb-1">Notice Board</h4>
            <p className="text-sm">{announcement}</p>
          </div>
        </div>
      )}

      {/* ACCESS EXPIRY WARNING */}
      {!validAccess && (
        <div className="bg-red-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between">
           <div className="flex items-center">
             <AlertTriangle className="w-6 h-6 mr-3" />
             <div>
               <h3 className="font-bold text-lg">Batch Access Expired</h3>
               <p className="text-sm opacity-90">
                 Your access was valid from <span className="font-mono bg-red-700 px-1 rounded">{user.validFrom}</span> to <span className="font-mono bg-red-700 px-1 rounded">{user.validUntil}</span>.
               </p>
             </div>
           </div>
           <Lock className="w-8 h-8 opacity-50" />
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-900 to-slate-800 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-white opacity-5 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">Welcome, {user.name}</h2>
            <div className="flex items-center space-x-4 text-sm text-blue-200">
               <span className="bg-white/10 px-3 py-1 rounded-full">Fee Status: ₹{user.paidAmount} Paid</span>
               <span>Total: ₹{user.totalFee}</span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-blue-200 mt-2">
               <span className="flex items-center"><Calendar className="w-3 h-3 mr-1"/> Valid: {user.validFrom} to {user.validUntil}</span>
            </div>
          </div>
          <div className="text-right">
             <div className="text-5xl font-black">{percentPaid}%</div>
             <div className="text-xs uppercase tracking-widest text-blue-300 font-bold mt-1">Content Unlocked</div>
          </div>
        </div>
        <div className="w-full bg-white/10 h-3 rounded-full mt-6 overflow-hidden">
          <div className="h-full bg-green-400 transition-all duration-1000" style={{ width: `${percentPaid}%` }}></div>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`font-bold text-lg ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>Assigned Books</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search library..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-9 pr-4 py-2 border rounded-full text-sm w-64 outline-none transition ${darkMode ? 'bg-slate-800 border-slate-700 text-white focus:border-blue-500' : 'bg-white border-slate-200 text-slate-800 focus:ring-2 focus:ring-blue-500'}`}
            />
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${!validAccess ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
          {filteredBooks.map(book => (
            <div key={book.id} onClick={() => validAccess && onOpen(book)} className={`rounded-xl border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <div className={`h-40 flex items-center justify-center transition-colors relative ${darkMode ? 'bg-slate-900 text-slate-600' : 'bg-slate-100 text-slate-300'}`}>
                {book.id === 'b4' ? (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <span className={`text-4xl mb-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>म</span>
                    <span className="text-[10px] uppercase font-bold text-blue-500">Marathi</span>
                  </div>
                ) : (
                  <BookOpen className={`w-16 h-16 group-hover:scale-110 transition-transform duration-300 ${darkMode ? 'group-hover:text-blue-400' : 'group-hover:text-blue-300'}`} />
                )}
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-slate-600 shadow-sm">
                  {book.totalPages} Pages
                </div>
              </div>
              <div className="p-5">
                <h4 className={`font-bold text-lg mb-2 leading-tight transition-colors line-clamp-2 ${darkMode ? 'text-slate-200 group-hover:text-blue-400' : 'text-slate-800 group-hover:text-blue-600'}`}>{book.title}</h4>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Secure PDF</span>
                  <button className="bg-blue-600 text-white p-2 rounded-full shadow-lg group-hover:bg-blue-700 transition">
                      <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. SECURE READER (WEB HARDENED)
// ==========================================
function SecureReader({ book, user, settings, darkMode, setDarkMode, onReportIssue, onClose }) {
  const [pageNum, setPageNum] = useState(1);
  const canvasRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const renderTaskRef = useRef(null);
  const [isObscured, setIsObscured] = useState(false);
  const [securityWarning, setSecurityWarning] = useState('');
  
  // Focus Detection State
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const accessRatio = user.paidAmount / user.totalFee;
  const maxPage = Math.floor(book.totalPages * accessRatio);
  const isLocked = pageNum > maxPage;

  useEffect(() => {
    const loadPdfLib = async () => {
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        };
        document.body.appendChild(script);
      }
    };
    loadPdfLib();
  }, []);

  useEffect(() => {
    if (book.hasFile) {
       const checkLib = setInterval(() => {
        if (window.pdfjsLib) {
          clearInterval(checkLib);
          LibraryDB.getFile(book.id).then(blob => {
             if(blob) {
                const url = URL.createObjectURL(blob);
                window.pdfjsLib.getDocument(url).promise.then(doc => {
                  setPdfDoc(doc);
                });
             }
          });
        }
      }, 500);
      return () => clearInterval(checkLib);
    }
  }, [book]);

  useEffect(() => {
    if (pdfDoc && !isLocked) {
      pdfDoc.getPage(pageNum).then(page => {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const viewport = page.getViewport({ scale: zoom * 1.5 });
        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          
          const renderTask = page.render(renderContext);
          renderTaskRef.current = renderTask;
          
          renderTask.promise.then(() => {
             // Draw Watermark
             context.save();
             context.globalAlpha = 0.15;
             context.font = `bold ${40 * zoom}px Arial`;
             context.fillStyle = darkMode ? 'white' : 'black'; 
             context.textAlign = 'center';
             context.textBaseline = 'middle';
             
             const stepX = 400 * zoom;
             const stepY = 400 * zoom;
             
             context.translate(canvas.width / 2, canvas.height / 2);
             context.rotate(-Math.PI / 6);
             context.translate(-canvas.width / 2, -canvas.height / 2);

             for(let x = -canvas.width; x < canvas.width * 2; x += stepX) {
                for(let y = -canvas.height; y < canvas.height * 2; y += stepY) {
                    context.fillText(settings.watermarkText, x, y);
                    context.fillText(user.id, x, y + 50 * zoom);
                }
             }
             context.restore();

          }).catch(error => {
             if (error.name !== "RenderingCancelledException") {
                console.error("Render error", error);
             }
          });
        }
      });
    }
  }, [pdfDoc, pageNum, isLocked, zoom, settings.watermarkText, user.id, darkMode]);

  // Security: Focus Detection & Keyboard Blocking
  useEffect(() => {
    const handleContext = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4'))) {
        e.preventDefault();
        setIsObscured(true);
        setSecurityWarning('Screenshots disabled');
        setTimeout(() => { setIsObscured(false); setSecurityWarning(''); }, 2000);
      }
    };
    
    // Focus Listeners
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => {
        setIsWindowFocused(false);
        setSecurityWarning('App backgrounded - Content Hidden');
    };

    window.addEventListener('contextmenu', handleContext);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('contextmenu', handleContext);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${darkMode ? 'bg-slate-900' : 'bg-slate-200'}`}>
      
      {/* ANTI-PRINT STYLE */}
      <style>{`
        @media print {
            html, body { display: none !important; }
            * { visibility: hidden !important; }
        }
      `}</style>

      {/* SECURITY OVERLAY */}
      {isObscured && (
        <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center text-white">
           <EyeOff className="w-24 h-24 mb-4 text-red-500" />
           <h2 className="text-3xl font-bold">Security Violation</h2>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-slate-800 text-white h-16 flex justify-between items-center px-4 shadow shrink-0 z-20 relative">
        <div className="flex items-center">
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full mr-3"><ChevronLeft /></button>
            <div className="font-bold truncate max-w-xs">{book.title}</div>
        </div>
        
        <div className="flex items-center space-x-2">
            {securityWarning && <div className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold animate-pulse">{securityWarning}</div>}
            
            <div className="flex bg-slate-700 rounded mr-4">
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-2 hover:bg-slate-600"><ZoomOut size={16}/></button>
                <span className="px-2 py-2 text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3.0, z + 0.2))} className="p-2 hover:bg-slate-600"><ZoomIn size={16}/></button>
            </div>
            
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full transition ${darkMode ? 'bg-slate-700 text-yellow-400' : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
             {darkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
           </button>

            <button onClick={() => {
                const issue = prompt("Describe issue with this page:");
                if (issue) onReportIssue(user.id, book.title, `Page ${pageNum}: ${issue}`);
            }} className="p-2 hover:bg-slate-600 rounded"><Flag size={18} className="text-red-400"/></button>
            
            <div className="text-xs bg-black/30 px-3 py-1 rounded">Page {pageNum} / {book.totalPages}</div>
        </div>
      </div>

      {/* MAIN READER AREA */}
      <div className="flex-1 overflow-auto flex justify-center p-0 relative">
        <div className={`relative shadow-2xl transition-all origin-top ${darkMode ? 'bg-slate-800' : 'bg-white'}`} style={{ minHeight: '80vh', margin: '2rem' }}>
          
          {/* BLUR CONTAINER ON FOCUS LOSS */}
          <div className={`relative z-10 transition-all duration-200 ${isWindowFocused ? 'blur-0 opacity-100' : 'blur-3xl opacity-0'}`}>
            {isLocked ? (
              <div className="flex flex-col items-center justify-center h-[80vh] w-full p-12">
                <Lock className="w-24 h-24 text-red-500 mb-4"/>
                <h2 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-slate-800'}`}>Content Locked</h2>
                <p className="text-slate-500 mt-2">Pay fees to unlock this page.</p>
              </div>
            ) : (
              book.hasFile ? (
                <canvas 
                    ref={canvasRef} 
                    className={`block ${darkMode ? 'invert hue-rotate-180 contrast-90' : ''}`} 
                />
              ) : (
                <div className={`p-12 max-w-3xl whitespace-pre-wrap ${darkMode?'text-slate-300':'text-slate-900'}`}>
                  {book.content || "No content found."}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-slate-800 h-16 flex justify-center items-center space-x-8 shrink-0 z-30 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button onClick={()=>setPageNum(p=>Math.max(1, p-1))} disabled={pageNum===1} className="p-2 bg-slate-700 rounded-full text-white disabled:opacity-50"><ChevronLeft/></button>
        <button onClick={()=>setPageNum(p=>Math.min(book.totalPages, p+1))} disabled={pageNum===book.totalPages} className="p-2 bg-slate-700 rounded-full text-white disabled:opacity-50"><ChevronRight/></button>
      </div>
    </div>
  );
}