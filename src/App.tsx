import React, { useEffect, useRef, useState } from 'react';
import {
  IonApp,
  IonRouterOutlet, IonTabs, IonTabBar, IonTabButton, IonIcon, IonFab, IonFabButton, IonModal,
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonInput, IonMenu, IonPage, IonButtons,
  IonMenuButton, IonFooter,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect, useHistory } from 'react-router';
import { home, list, statsChart, add, settingsOutline, homeOutline, clipboard } from 'ionicons/icons';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import { toast, ToastContainer, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './theme/variables.css';
import './theme/global.css';
import ExpenseFormModal from './components/ExpenseFormModal';
import Dashboard from './components/Dashboard';
import { db, initializeDB } from './db';
import Categories from './components/Categories';
import Report from './components/TodaysExpenses';
import { StatusBar, Style } from '@capacitor/status-bar';
import Sidebar from './components/Sidebar';
import ExpenseList from './components/MonthlyExpenseList';
import AllExpenses from './components/AllExpenses';
import Modal from 'react-modal';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { JSX } from 'react/jsx-runtime';
import WebBackup from './components/WebBackup';

// Call the element loader after the platform has been bootstrapped
defineCustomElements(window);
const App: React.FC = () => {
  const [showNameModal, setShowNameModal] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [tempName, setTempName] = useState<string>('');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [expGroups, setExpGroups] = useState<any[]>([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [masterInput, setMasterInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showMasterModal, setShowMasterModal] = useState(false);
  const history = useHistory();
  const [statusBarHeight, setStatusBarHeight] = useState(0);
  const tabBarRef = useRef<HTMLIonTabBarElement>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(localStorage.getItem('selectedGroupName'));

  useEffect(() => {
    initializeDB();

    SafeArea.getStatusBarHeight().then((info) => {
      setStatusBarHeight(info.statusBarHeight);
    });
    StatusBar.setOverlaysWebView({ overlay: true });
    StatusBar.setStyle({ style: Style.Light });
    StatusBar.show();
    StatusBar.setBackgroundColor({ color: '#1a65eb' });
    setSelectedGroupId(Number(localStorage.getItem('selectedGroupId')) || null);

    const storedName = localStorage.getItem('userName');
    const storedPassword = localStorage.getItem('app_password');
    if (!storedName) {
      setShowNameModal(true);
    } else if (storedPassword) {
      setShowPasswordModal(true);
    } else {
      setUserName(storedName);
    }
    const fetchGroups = async () => {
      const allGroups = await db.accounts.toArray();
      setExpGroups(allGroups);
    }
    fetchGroups();

    // Listen for changes in localStorage for selectedGroupName
    const handleStorageChange = () => {
      setSelectedGroupName(localStorage.getItem('selectedGroupName'));
    };
    window.addEventListener('storage', handleStorageChange);

    // Also update when Sidebar changes group (in same tab)
    const interval = setInterval(() => {
      const name = localStorage.getItem('selectedGroupName');
      if (name !== selectedGroupName) setSelectedGroupName(name);
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [selectedGroupName]);

  const handleSaveName = () => {
    if (tempName.trim()) {
      localStorage.setItem('userName', tempName.trim());
      setUserName(tempName.trim());
      setShowNameModal(false);
      toast.success('Welcome, ' + tempName.trim());
    }
  };

  // Password check logic:
  const handlePasswordCheck = () => {
    const storedPassword = localStorage.getItem('app_password');
    if (passwordInput === storedPassword) {
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError('');
      setUserName(localStorage.getItem('userName') || '');
      history.push('/categories');
      setActiveTab('categories');
    } else {
      setPasswordError('Incorrect password');
    }
  };

  const handleForgotPassword = () => {
    setShowPasswordModal(false);
    setShowMasterModal(true);
    setPasswordInput('');
    setPasswordError('');
  };

  const handleMasterCheck = () => {
    const storedName = localStorage.getItem('userName') || '';
    const masterPassword = storedName.length >= 2
      ? storedName[0].toUpperCase() + storedName[storedName.length - 1].toUpperCase()
      : '';
    if (masterInput === masterPassword) {
      setShowMasterModal(false);
      setMasterInput('');
      setPasswordError('');
      setUserName(storedName);
      setShowPasswordModal(false);
      toast.success('Master password accepted. You are logged in.');
      history.push('/categories');
      setActiveTab('categories');
    } else {
      setPasswordError('Incorrect master password');
    }
  };
  async function loadGroups(event: React.MouseEvent<HTMLIonButtonsElement, MouseEvent>): Promise<void> {
    const allGroups = await db.accounts.toArray();
    setExpGroups(allGroups);
  }
  const openCategory = () => {
    history.push("/categories");
    setActiveTab('Manage');
  }
  return (
    <IonApp >

      {/* Sidebar */}
            {/* Toast Notifications */}
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        transition={Slide}
        style={{
          marginTop: 120,
          
        }}
        toastStyle={{
          borderRadius: 8,
          color: "#1976d2",
          fontWeight: 600,
          width: "80%",
          boxShadow: "0 4px 24px rgba(25,118,210,0.13)",
          zIndex: 99000,
        }}
        bodyStyle={{
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: 0.2,
          zIndex: 99000,
        }}
        closeButton={true}
      />
      <IonMenu className="sidebar" contentId="main-content" type="overlay" side="start" swipeGesture={true}>
        <IonHeader
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)', // Handles notch if present, 0px otherwise
            marginTop: 0 // Remove any marginTop
          }}>
          <IonToolbar
            color="primary"
            style={{
              background: 'transparent',
              marginTop: statusBarHeight // Remove this if present
            }}
          >
            <IonButtons slot="start" onClick={loadGroups}>
              <IonMenuButton />
            </IonButtons>
            <IonTitle>
              Transection Groups
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div
            style={{
              position: "fixed",
              bottom: 300,
              right: 0,
              left: 0,
              zIndex: 3000,
              textAlign: "center",
              pointerEvents: "none",
              userSelect: "none",
              opacity: 0.03,
              fontSize: "4.5vw",
              fontWeight: 900,
              letterSpacing: 1,
              color: "#1976d2",
              fontFamily: "monospace",
              textTransform: "lowercase",
              width: "100%",
              transform: "rotate(-60deg)", // <-- Make watermark diagonal
              transformOrigin: "center",
            }}
          >
            kktechssol.
          </div>
          <Sidebar
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
            marginTop={statusBarHeight}
          />

          <IonFooter
            style={{
              background: "#0054e9",
              height: 72,
              bottom: 0,
              position: 'fixed',
              borderTop: "1px solid #e3eafc",
              boxShadow: "0 -2px 8px rgba(25,118,210,0.06)",
              padding: "12px 0",
              textAlign: "center"
            }}
          >
            <div style={{
              color: "#fff",
              fontWeight: 800,
              fontSize: 16,
              lineHeight: 3,
              letterSpacing: 1,
              fontFamily: "monospace"
            }}>
              &copy; {new Date().getFullYear()} kktechsol.
            </div>
          </IonFooter>
        </IonContent>
      </IonMenu>



      {/* Main Content */}
      <IonPage id="main-content">
        <IonHeader>
          <IonToolbar color="primary"
            style={{
              paddingTop: 'env(safe-area-inset-top)', // Ensures safe area at top
              background: 'transparent'
            }}
          >
            <IonButtons slot="start" onClick={loadGroups}>
              <IonMenuButton />
            </IonButtons>
            <IonTitle>
              {activeTab}
            </IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={openCategory}>
                <IonIcon icon={settingsOutline} />
              </IonButton>
            </IonButtons>
            <br />
            <center style={{ fontSize: 10, fontWeight: 500, opacity: 0.8, marginTop: 8 }}>
              {selectedGroupName}
            </center> 
          </IonToolbar>
        </IonHeader>

        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/dashboard">
              <Dashboard marginTop={55} />
            </Route>
            <Route exact path="/expenses">
              <ExpenseList selectedGroupId={selectedGroupId} marginTop={55} />
            </Route>
            <Route exact path="/report">
              <Report marginTop={55} />
            </Route>
            <Route exact path="/transactions">
              <AllExpenses selectedGroupId={selectedGroupId} marginTop={55 } />
            </Route>



            <Route exact path="/categories">
              <Categories marginTop={55} />
            </Route>


            <Redirect exact from="/" to="/dashboard" />
          </IonRouterOutlet>

          <div
            style={{
              position: "fixed",
              bottom: 300,
              right: 0,
              left: 0,
              zIndex: 3000,
              textAlign: "center",
              pointerEvents: "none",
              userSelect: "none",
              opacity: 0.03,
              fontSize: "5vw",
              fontWeight: 900,
              letterSpacing: 1,
              color: "#1976d2",
              fontFamily: "monospace",
              textTransform: "lowercase",
              width: "100%",
              transform: "rotate(-60deg)", // <-- Make watermark diagonal
              transformOrigin: "center",
            }}
          >
            kktechsol.
          </div>


          <IonTabBar ref={tabBarRef}
            slot="bottom"
            color={'primary'}
            onIonTabsDidChange={e => setActiveTab(e.detail.tab)}
            className='bottomTabBar'

          >
            <IonTabButton tab="Dashboard" href="/dashboard" >
              <IonIcon icon={homeOutline} />
            </IonTabButton>
            <IonTabButton tab="Report" href="/report">
              <IonIcon icon={statsChart} />
            </IonTabButton>

            <IonTabButton tab="Add Transection" href='/report'>
              <IonFab vertical='bottom'>
                <IonFabButton color={'light'} onClick={() => setShowExpenseModal(true)}>
                  <IonIcon icon={add}></IonIcon>
                </IonFabButton>
              </IonFab>
            </IonTabButton>
            <IonTabButton tab="Expenses" href="/expenses" >
              <IonIcon icon={list} />
            </IonTabButton>
            <IonTabButton tab="All Transecctions" href="/transactions">
              <IonIcon icon={clipboard} />
            </IonTabButton>



          </IonTabBar>
        </IonTabs>

      </IonPage>



      {/* Name Modal */}
      <IonModal isOpen={showNameModal} backdropDismiss={false}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle>Welcome!</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ maxWidth: 340, margin: "0 auto", marginTop: 40 }}>
            <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Please enter your name to get started</h2>
            <IonInput
              value={tempName}
              placeholder="Your name"
              onIonChange={e => setTempName(e.detail.value!)}
              style={{ marginBottom: 24, borderRadius: 12, background: "#fff" }}
            />
            <IonButton expand="block" color="primary" onClick={handleSaveName} disabled={!tempName.trim()}>
              Continue
            </IonButton>
          </div>
        </IonContent>
      </IonModal>
      <Modal
        isOpen={showPasswordModal}
        onRequestClose={() => { }}
        shouldCloseOnOverlayClick={false}
        ariaHideApp={false}
        style={{
          overlay: {
            backgroundColor: 'rgba(25,118,210,0.13)',
            zIndex: 2001,
            backdropFilter: 'blur(3px)'
          },
          content: {
            maxWidth: 360,
            width: '90vw',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 8px 36px 0 rgba(25, 118, 210, 0.18)",
            padding: 0,
            border: 'none',
            minHeight: 0,
            overflow: 'visible'
          }
        }}
      >
        <div style={{ padding: 28 }}>
          <h2 style={{ textAlign: 'center', marginBottom: 24, color: "#1976d2" }}>
            Please enter your password to continue
          </h2>
          <IonInput
            type="password"
            value={passwordInput}
            placeholder="Password"
            onIonChange={e => setPasswordInput(e.detail.value!)}
            style={{
              marginBottom: 16,

              color: "#1976d2"
            }}
          />
          {passwordError && (
            <div style={{ color: 'red', marginBottom: 12 }}>{passwordError}</div>
          )}
          <IonButton
            expand="block"
            color="primary"
            onClick={handlePasswordCheck}
            style={{ borderRadius: 12, fontWeight: 600 }}
          >
            Continue
          </IonButton>
          <IonButton
            expand="block"
            fill="clear"
            color="medium"
            onClick={handleForgotPassword}
            style={{ marginTop: 8 }}
          >
            Forgot Password?
          </IonButton>
        </div>
      </Modal>

      <Modal
        isOpen={showMasterModal}
        onRequestClose={() => { }}
        shouldCloseOnOverlayClick={false}
        ariaHideApp={false}
        style={{
          overlay: {
            backgroundColor: 'rgba(25,118,210,0.13)',
            zIndex: 2001,
            backdropFilter: 'blur(3px)'
          },
          content: {
            maxWidth: 360,
            width: '90vw',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 8px 36px 0 rgba(25, 118, 210, 0.18)",
            padding: 0,
            border: 'none',
            minHeight: 0,
            overflow: 'visible'
          }
        }}
      >
        <div style={{ padding: 28 }}>
          <h2 style={{ textAlign: 'center', marginBottom: 24, color: "#1976d2" }}>
            Forgot Password?
          </h2>
          <p style={{ textAlign: 'center', marginBottom: 18, color: "#444" }}>
            Enter your master password (first and last letter of your name, uppercase) to unlock the app.
          </p>
          <IonInput
            type="password"
            value={masterInput}
            placeholder="Master Password"
            onIonChange={e => setMasterInput(e.detail.value!)}
            style={{
              marginBottom: 16,

              color: "#1976d2"
            }}
          />
          {passwordError && (
            <div style={{ color: 'red', marginBottom: 12 }}>{passwordError}</div>
          )}
          <IonButton
            expand="block"
            color="primary"
            onClick={handleMasterCheck}
            disabled={!masterInput.trim()}
            style={{ borderRadius: 12, fontWeight: 600 }}
          >
            Continue
          </IonButton>
          <IonButton
            expand="block"
            fill="clear"
            color="medium"
            onClick={() => {
              setShowMasterModal(false);
              setShowPasswordModal(true);
              setMasterInput('');
              setPasswordError('');
            }}
            style={{ marginTop: 8 }}
          >
            Back to Password
          </IonButton>
        </div>
      </Modal>
      <ExpenseFormModal
        isOpen={showExpenseModal}
        onRequestClose={() => setShowExpenseModal(false)}
        onExpenseAdded={() => {
          // Refresh list or show a message
        }}
      />
    </IonApp>
  );
};

export default App;

function render(arg0: JSX.Element) {
  throw new Error('Function not implemented.');
}
