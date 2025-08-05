import React, { useState, useEffect } from 'react';
import { IonIcon } from '@ionic/react';
import {
    personOutline,
    keyOutline,
    logOutOutline,
    logInOutline,
    saveOutline,
    refreshOutline,
    alertCircleOutline,
    checkmarkCircleOutline
} from 'ionicons/icons';


// Define the shape of the user and response data to ensure type safety.
interface UserData {
    username: string;
    token: string;
}

interface ApiResponse {
    message?: string;
    error?: string;
    token?: string;
}

const WebBackup: React.FC = () => {
    // State for user authentication and data
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<string | null>(null);
    const [backupData, setBackupData] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<"login" | "register" | "dashboard">('login');

    // State for form inputs and UI feedback
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // --- API Configuration ---
    // Update this to match the URL of your PHP server
    const API_URL = 'http://localhost/backup';

    // --- API Calls ---

    /**
     * Handles the user registration process.
     */
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            const data: ApiResponse = await response.json();

            if (response.ok) {
                setMessage(data.message || 'Registration successful!');
                setIsSuccess(true);
                setCurrentPage('login');
            } else {
                setMessage(data.error || 'An unknown error occurred.');
                setIsSuccess(false);
            }
        } catch (error) {
            setMessage('Network error. Please try again.');
            setIsSuccess(false);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Handles the user login process.
     */
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });
            const data: ApiResponse = await response.json();

            if (response.ok && data.token) {
                setToken(data.token);
                setUser(username);
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', username);
                setMessage(data.message || 'Login successful!');
                setIsSuccess(true);
                setCurrentPage('dashboard');
            } else {
                setMessage(data.error || 'Invalid username or password.');
                setIsSuccess(false);
            }
        } catch (error) {
            setMessage('Network error. Please try again.');
            setIsSuccess(false);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Handles user logout, clearing state and local storage.
     */
    const handleLogout = () => {
        setToken(null);
        setUser(null);
        setBackupData('');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setCurrentPage('login');
        setMessage('You have been logged out.');
        setIsSuccess(true);
    };

    /**
     * Saves the current backup data to the server.
     */
    const handleSaveBackup = async () => {
        if (!token) return;
        setMessage('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/backup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ data: backupData }),
            });
            const data: ApiResponse = await response.json();

            if (response.ok) {
                setMessage(data.message || 'Backup saved successfully.');
                setIsSuccess(true);
            } else {
                setMessage(data.error || 'Failed to save backup.');
                setIsSuccess(false);
            }
        } catch (error) {
            setMessage('Network error. Failed to save backup.');
            setIsSuccess(false);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Retrieves the latest backup data from the server.
     */
    const handleRetrieveBackup = async () => {
        if (!token) return;
        setMessage('');
        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/backup`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data: ApiResponse = await response.json();

            if (response.ok) {
                setBackupData(JSON.stringify(data, null, 2));
                setMessage('Backup data retrieved successfully.');
                setIsSuccess(true);
            } else {
                setMessage(data.error || 'No backup found.');
                setIsSuccess(false);
            }
        } catch (error) {
            setMessage('Network error. Failed to retrieve backup.');
            setIsSuccess(false);
        } finally {
            setIsLoading(false);
        }
    };

    // This effect runs once on component mount to check for an existing session token.
    useEffect(() => {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(storedUser);
            setCurrentPage('dashboard');
            handleRetrieveBackup();
        }
    }, []);

    // --- Render Logic ---

    const renderLoginForm = () => (
        <form onSubmit={handleLogin} className="space-y-4 w-full">
            <h2 className="text-2xl font-bold text-center text-gray-800">Login</h2>
            <div className="relative">
                <IonIcon icon={personOutline} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <div className="relative">
                <IonIcon icon={keyOutline} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300 flex items-center justify-center space-x-2 disabled:bg-indigo-400"
            >
                {isLoading ? (
                    <span className="flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Logging in...</span>
                    </span>
                ) : (
                    <span className="flex items-center space-x-2">
                        <IonIcon icon={logInOutline} />
                        <span>Log In</span>
                    </span>
                )}
            </button>
            <p className="text-center text-sm text-gray-600">
                Don't have an account? <span onClick={() => setCurrentPage('register')} className="text-indigo-600 font-semibold cursor-pointer hover:underline">Register here.</span>
            </p>
        </form>
    );

    const renderRegisterForm = () => (
        <form onSubmit={handleRegister} className="space-y-4 w-full">
            <h2 className="text-2xl font-bold text-center text-gray-800">Register</h2>
            <div className="relative">
                <IonIcon icon={personOutline} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <div className="relative">
                <IonIcon icon={keyOutline} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300 flex items-center justify-center space-x-2 disabled:bg-indigo-400"
            >
                 {isLoading ? (
                    <span className="flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Registering...</span>
                    </span>
                ) : (
                    <span>Register</span>
                )}
            </button>
            <p className="text-center text-sm text-gray-600">
                Already have an account? <span onClick={() => setCurrentPage('login')} className="text-indigo-600 font-semibold cursor-pointer hover:underline">Log in here.</span>
            </p>
        </form>
    );

    const renderDashboard = () => (
        <div className="space-y-4 w-full">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Welcome, {user}!</h2>
                <button
                    onClick={handleLogout}
                    className="text-white bg-gray-500 py-2 px-4 rounded-md hover:bg-gray-600 transition duration-300 flex items-center space-x-2"
                >
                    <IonIcon icon={logOutOutline} />
                    <span>Logout</span>
                </button>
            </div>
            <textarea
                value={backupData}
                onChange={(e) => setBackupData(e.target.value)}
                placeholder="Paste or edit your JSON backup data here..."
                rows={10}
                className="w-full p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            ></textarea>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 justify-end">
                <button
                    onClick={handleRetrieveBackup}
                    disabled={isLoading}
                    className="bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition duration-300 flex items-center justify-center space-x-2 disabled:bg-green-400"
                >
                    {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <IonIcon icon={refreshOutline} />
                    )}
                    <span>Retrieve Backup</span>
                </button>
                <button
                    onClick={handleSaveBackup}
                    disabled={isLoading}
                    className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-300 flex items-center justify-center space-x-2 disabled:bg-indigo-400"
                >
                    {isLoading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <IonIcon icon={saveOutline} />
                    )}
                    <span>Save Backup</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans flex items-center justify-center">
            <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl w-full max-w-lg">
                <div className="mb-6">
                    {message && (
                        <div
                            className={`p-4 rounded-md flex items-center space-x-3 ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                            {isSuccess ? <IonIcon icon={checkmarkCircleOutline} /> : <IonIcon icon={alertCircleOutline} />}
                            <p>{message}</p>
                        </div>
                    )}
                </div>

                {currentPage === 'login' && renderLoginForm()}
                {currentPage === 'register' && renderRegisterForm()}
                {currentPage === 'dashboard' && renderDashboard()}
            </div>
        </div>
    );
};

export default WebBackup;
