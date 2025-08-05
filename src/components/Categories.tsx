import React, { useState, useEffect, useRef, use } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonButtons,
  IonItemDivider,
  IonFab,
  IonFabButton,
  IonAvatar,
} from '@ionic/react';
import { add, trash, create, cloudUpload, cloudDownload, close, lockClosed, eyeOff, key } from 'ionicons/icons';
import { db } from '../db';
import { Category } from '../db';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { ToastContainer, toast } from 'react-toastify';
import Modal from 'react-modal';
import { useHistory } from 'react-router';
interface CategoriesProps {
  marginTop: number;
}
const Categories: React.FC<CategoriesProps> = ({ marginTop }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Partial<Category>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showIncome, setShowIncome] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [webToken, setWebToken] = useState<string | null>(null);
  const [webUser, setWebUser] = useState<string | null>(null);
  const [webUsername, setWebUsername] = useState('');
  const [webPassword, setWebPassword] = useState('');
  const [webLoading, setWebLoading] = useState(false);
  const [webMode, setWebMode] = useState<'login' | 'register'>('login');
  const [showWebBackupModal, setShowWebBackupModal] = useState(false);
  const [webMsg, setWebMsg] = useState('');
   const API_URL = 'http://expensebackup.atwebpages.com/api.php';


 // const API_URL = 'http://localhost/backup/api.php'; // Update to your actual API URL
  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line
  }, []);

  // Ensure showIncome is synced with localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('show_income');
    setShowIncome(stored === null ? true : stored === 'true');
  }, []);

  const loadCategories = async () => {
    try {
      const allCategories = await db.categories.toArray();
      setCategories(allCategories);
    } catch (error) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategory = async () => {
    if (!currentCategory.name || !currentCategory.type) {
      toast.warning('Name and type are required');
      return;
    }

    try {
      if (currentCategory.id) {
        await db.categories.update(currentCategory.id, currentCategory);
        toast.success('Category updated successfully');
      } else {
        await db.categories.add(currentCategory as Category);
        toast.success('Category added successfully');
      }
      loadCategories();
      setShowModal(false);
      setCurrentCategory({});
    } catch (error) {
      toast.error('Error saving category');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      const expensesCount = await db.expenses.where('categoryId').equals(id).count();
      if (expensesCount > 0) {
        toast.warning('Cannot delete category with associated expenses');
        return;
      }
      await db.categories.delete(id);
      toast.success('Category deleted successfully');
      loadCategories();
    } catch (error) {
      toast.error('Error deleting category');
    } finally {
      setShowDeleteModal(false);
      setCategoryToDelete(null);
    }
  };

  const openEditModal = (category: Category) => {
    setCurrentCategory(category);
    setShowModal(true);
  };

  const openAddModal = () => {
    setCurrentCategory({
      type: 'expense',
      color: '#FF6384',
      icon: 'receipt'
    });
    setShowModal(true);
  };

  // Backup the whole database to device storage (now includes accounts/groups)
  const backupToDevice = async () => {
    try {
      const categories = await db.categories.toArray();
      const expenses = await db.expenses.toArray();
      const accounts = await db.accounts.toArray(); // <-- include accounts/groups

      const data = JSON.stringify({ categories, expenses, accounts }, null, 2);

      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(
        now.getSeconds()
      ).padStart(2, '0')}`;
      const fileName = `expenses-backup-${timestamp}.json`;

      if ((window as any).Capacitor?.isNativePlatform()) {
        await Filesystem.writeFile({
          path: fileName,
          data,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        toast.success(`Backup saved as ${fileName}`);
      } else {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Backup downloaded as ${fileName}`);
      }
    } catch (err) {
      toast.warning('Backup failed');
    }
  };

  // Restore the whole database from device storage (now restores accounts/groups too)
  const restoreFromDevice = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.categories && data.expenses && data.accounts) {
        await db.transaction('rw', db.categories, db.expenses, db.accounts, async () => {
          await db.categories.clear();
          await db.categories.bulkAdd(data.categories);
          await db.expenses.clear();
          await db.expenses.bulkAdd(data.expenses);
          await db.accounts.clear();
          await db.accounts.bulkAdd(data.accounts);
        });
        toast.success('Database restored successfully');
        window.location.reload(); // Reload to reflect changes
        loadCategories();
      } else {
        toast.error('Invalid backup file format');
      }
    } catch {
      toast.error('Failed to restore database');
    }
  };

  const handleSavePassword = () => {
    let masterPassword = "";
    const userName = localStorage.getItem('userName');
    if (userName) {
      masterPassword = userName[0].toUpperCase() + userName[userName.length - 1].toUpperCase();
      localStorage.setItem('master_password', masterPassword);
    }
    if (password.trim().length < 4) {
      toast.warning('Password must be at least 4 characters');
      return;
    }
    localStorage.setItem('app_password', password);

    toast.success('Password set!');
    setPassword('');
    setShowSettingsModal(false);



  };

  const handleToggleIncome = () => {
    setShowIncome(prev => {
      localStorage.setItem('show_income', (!prev).toString());
      return !prev;
    });
  };





  const handleWebLogin = async () => {
    setWebLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: webUsername, password: webPassword })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('webBackupToken', data.token);
        localStorage.setItem('webBackupUser', webUsername);
        setWebToken(data.token);
        setWebUser(webUsername);
        toast.success('Login successful!');
        setShowWebBackupModal(false);
      } else {
        toast.error(data.error || 'Login failed');
        setWebMsg(data.error || 'Login failed');


      }
    } catch {
      toast.error('Network error');
      setWebMsg('Network error');
    }
    setWebLoading(false);
  };

  const handleWebRegister = async () => {
    setWebLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: webUsername, password: webPassword })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('webBackupToken', data.token);
        localStorage.setItem('webBackupUser', webUsername);
        setWebToken(data.token);
        setWebUser(webUsername);
        toast.success('Registered & logged in!');
        setShowWebBackupModal(false);
      } else {
        toast.error(data.error || 'Registration failed');
        setWebMsg(data.error || 'Registration failed');
      }
    } catch {
      toast.error('Network error');
      setWebMsg('Network error');
    }
    setWebLoading(false);
  };

  const handleWebBackup = async () => {
    setWebLoading(true);
    try {
      const categories = await db.categories.toArray();
      const expenses = await db.expenses.toArray();
      const accounts = await db.accounts.toArray();
      const backup = JSON.stringify({ categories, expenses, accounts });
      const token = webToken || localStorage.getItem('webBackupToken');
      const res = await fetch(`${API_URL}?action=backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ backup })
      });
      const data = await res.json();
      if (data.message) {
        toast.success(data.message);
      } else {
        toast.error(data.error || 'Backup error');
      }
    } catch {
      toast.error('Network error');
    }
    setWebLoading(false);
  };

  const handleWebRestore = async () => {
    setWebLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=restore`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${webToken}` }
      });
      const data = await res.json();
      if (data.backup) {
        const backup = JSON.parse(data.backup);
        await db.transaction('rw', db.categories, db.expenses, db.accounts, async () => {
          await db.categories.clear();
          await db.categories.bulkAdd(backup.categories);
          await db.expenses.clear();
          await db.expenses.bulkAdd(backup.expenses);
          await db.accounts.clear();
          await db.accounts.bulkAdd(backup.accounts);
        });
        toast.success('Restore successful!');
        window.location.reload();
      } else {
        toast.error(data.error || 'Restore error');
      }
    } catch {
      toast.error('Network error');
    }
    setWebLoading(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('webBackupToken');
    const user = localStorage.getItem('webBackupUser');
    if (token && user) {
      setWebToken(token);
      setWebUser(user);
    }
  }, []);

  const ColorfulSpinner: React.FC<{ visible: boolean }> = ({ visible }) => (
  visible ? (
    <div className="colorful-spinner-overlay">
      <div className="colorful-spinner"></div>
    </div>
  ) : null
);

  return (
  <IonPage style={{ paddingTop: marginTop }} >
    <ColorfulSpinner visible={webLoading} />
    <IonContent style={{ background: "#f6f8fa" }}>
      {/* Responsive backup/settings block */}
      <div

        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          maxWidth: 600,
          margin: "0 auto",
          padding: 16,
          background: "#fff",
          boxShadow: "0 2px 12px rgba(25,118,210,0.08)",
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderRadius: 0,
        }}
      >



        {webToken ?

          <div
            style={{
              background: "linear-gradient(135deg, #e3f2fd 0%, #fff 100%)",

              borderRadius: 18,
              boxShadow: "0 4px 24px rgba(25,118,210,0.10)",
              width: '100%',
              maxWidth: 500,
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >



            <h3 style={{
              marginBottom: 12,
              fontWeight: 700,
              fontSize: 22,
              color: '#1976d2',
              textAlign: 'center',
              letterSpacing: 1,
            }}>
              Logged in as <b style={{ color: '#0000ff' }}>{webUser} </b>
            </h3>
            <div style={{
              fontSize: 12,
              color: "#1976d2",
              fontWeight: 600,
              textAlign: 'center'
            }}>

              Want To
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('webBackupToken');
                  localStorage.removeItem('webBackupUser');
                  setWebToken(null);
                  setWebUser(null);
                }}
                className="logoutButton"

              >
                Logout
              </button>
            </div>




            <IonButton
              color="primary"
              onClick={handleWebBackup}
              disabled={webLoading}
              style={{ borderRadius: 16, fontWeight: 600, width: '100%' }}
            >
              Backup to Web
            </IonButton>


            <IonButton
              color="tertiary"
              onClick={handleWebRestore}
              disabled={webLoading}
              style={{ borderRadius: 16, fontWeight: 600, width: '100%' }}
            >
              Restore from Web
            </IonButton>



          </div>

          :
          <>

            <IonButton
              expand="block"
              color="primary"
              style={{ borderRadius: 16, marginBottom: 12, fontWeight: 600, width: '100%' }}
              onClick={() => setShowWebBackupModal(true)}
            >
              Web Backup & Restore
            </IonButton>


            <IonButton expand="block" color="primary" onClick={backupToDevice} style={{ borderRadius: 16, marginBottom: 12, fontWeight: 600, width: '100%' }}>
              <IonIcon icon={cloudUpload} slot="start" />
              Backup Full Database to Device
            </IonButton>
            <IonButton expand="block" color="tertiary" style={{ borderRadius: 16, marginBottom: 12, fontWeight: 600, width: '100%' }}>
              <label style={{ width: '100%', cursor: 'pointer', margin: 0 }}>
                <IonIcon icon={cloudDownload} slot="start" />
                Restore Full Database from File
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={restoreFromDevice}
                  ref={fileInputRef}
                />
              </label>
            </IonButton>




          </>}




        <IonButton
          expand="block"
          color="medium"
          style={{ borderRadius: 16, fontWeight: 600, width: '100%' }}
          onClick={() => setShowSettingsModal(true)}
        >
          <IonIcon icon={lockClosed} slot="start" />
          Privacy & Security Settings
        </IonButton>



      </div>

      {/* Responsive categories container */}
      <div
        className="categories-responsive"
        style={{
          maxWidth: 600,
          margin: "0 auto",
          padding: "24px 8px 24px 8px",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        {loading ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>Loading categories...</IonLabel>
          </div>
        ) : categories.length === 0 ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>No categories found</IonLabel>
            <IonButton expand="block" onClick={openAddModal} color="primary" style={{ borderRadius: 16, marginTop: 16 }}>
              <IonIcon icon={add} slot="start" />
              Add First Category
            </IonButton>
          </div>
        ) : (
          <>
            <IonList style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
              <IonItemDivider color="light" style={{
                borderRadius: 10,
                margin: "18px 0 8px 0",
                fontWeight: 600,
                fontSize: 16,
                background: "#e3f2fd"
              }}>
                Income Categories
              </IonItemDivider>
              {categories
                .filter(c => c.type === 'income')
                .map(category => (
                  <IonItem
                    key={category.id}
                    style={{
                      borderRadius: 14,
                      marginBottom: 10,
                      background: "#f9f9f9",
                      boxShadow: "0 2px 10px rgba(25,118,210,0.04)",
                      borderLeft: `6px solid ${category.color || "#ccc"}`,
                      alignItems: "center",
                      width: "100%",
                      marginLeft: "auto",
                      marginRight: "auto",
                      flexWrap: "wrap"
                    }}
                  >
                    <IonAvatar slot="start" style={{
                      background: category.color || "#eee",
                      marginLeft: -12,
                      marginRight: 12,
                      width: 30,
                      height: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <IonIcon icon={category.icon} style={{ color: "#fff", fontSize: 24 }} />
                    </IonAvatar>
                    <IonLabel>
                      <h2 style={{ fontWeight: 600, fontSize: 18, marginBottom: 2 }}>{category.name}</h2>
                    </IonLabel>
                    <IonButtons slot="end">
                      <IonButton
                        fill="clear"
                        color="primary"
                        onClick={() => openEditModal(category)}
                        style={{ marginRight: 4 }}
                      >
                        <IonIcon icon={create} />
                      </IonButton>
                      <IonButton
                        fill="clear"
                        color="danger"
                        onClick={() => {
                          setCategoryToDelete(category.id!);
                          setShowDeleteModal(true);
                        }}
                      >
                        <IonIcon icon={trash} />
                      </IonButton>
                    </IonButtons>
                  </IonItem>
                ))}

              <IonItemDivider color="light" style={{
                borderRadius: 10,
                margin: "18px 0 8px 0",
                fontWeight: 600,
                fontSize: 16,
                background: "#ffebee"
              }}>
                Expense Categories
              </IonItemDivider>
              {categories
                .filter(c => c.type === 'expense')
                .map(category => (
                  <IonItem
                    key={category.id}
                    style={{
                      borderRadius: 14,
                      marginBottom: 10,
                      background: "#f9f9f9",
                      boxShadow: "0 2px 10px rgba(244,67,54,0.04)",
                      borderLeft: `6px solid ${category.color || "#ccc"}`,
                      alignItems: "center",
                      width: "100%",
                      marginLeft: "auto",
                      marginRight: "auto",
                      flexWrap: "wrap"
                    }}
                  >
                    <IonAvatar slot="start" style={{
                      background: category.color || "#eee",
                      marginLeft: -12,
                      marginRight: 12,
                      width: 30,
                      height: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <IonIcon icon={category.icon} style={{ color: "#fff", fontSize: 24 }} />
                    </IonAvatar>


                    <IonLabel>
                      <h2 style={{ fontWeight: 600, fontSize: 18, marginBottom: 2 }}>{category.name}</h2>
                    </IonLabel>
                    <IonButtons slot="end">
                      <IonButton
                        fill="clear"
                        color="primary"
                        onClick={() => openEditModal(category)}
                        style={{ marginRight: 4 }}
                      >
                        <IonIcon icon={create} />
                      </IonButton>
                      <IonButton
                        fill="clear"
                        color="danger"
                        onClick={() => {
                          setCategoryToDelete(category.id!);
                          setShowDeleteModal(true);
                        }}
                      >
                        <IonIcon icon={trash} />
                      </IonButton>
                    </IonButtons>
                  </IonItem>
                ))}

              <div className='extraSpace'></div>
            </IonList>

            <IonFab
              className='categoryFAB'
              vertical="bottom"
              horizontal="end"
              slot="fixed"
              style={{
                position: 'fixed',
                bottom: 85,
                right: 24,
                zIndex: 1555, // above modals and content
              }}
            >
              <IonFabButton onClick={openAddModal} color="primary">
                <IonIcon icon={add} />
              </IonFabButton>
            </IonFab>
          </>
        )}
      </div>

      {/* Add/Edit Modal (React Modal) */}
      <Modal
        isOpen={showModal}
        onRequestClose={() => setShowModal(false)}
        contentLabel={currentCategory.id ? 'Edit Category' : 'Add Category'}
        style={{
          overlay: {
            backgroundColor: 'rgba(25,118,210,0.13)',
            zIndex: 1100,
            backdropFilter: 'blur(3px)'
          },
          content: {
            maxWidth: 400,
            width: '95vw',
            top: '45%',
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
        <form
          onSubmit={e => {
            e.preventDefault();
            if (!currentCategory.name || !currentCategory.type) {
              toast.warning('Name and type are required');
              return;
            }
            handleSaveCategory();
          }}
          style={{ padding: 24 }}
          autoComplete="off"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{ fontWeight: 700, fontSize: 20, color: '#1976d2', margin: 0 }}>
              {currentCategory.id ? 'Edit Category' : 'Add Category'}
            </h2>
            <IonButton fill="clear" onClick={() => setShowModal(false)} type="button">
              <IonIcon icon={close} />
            </IonButton>
          </div>
          <div style={{ maxWidth: 340, margin: "0 auto" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Name</label>
              <input
                type="text"
                value={currentCategory.name || ''}
                onChange={e => setCurrentCategory({
                  ...currentCategory,
                  name: e.target.value
                })}
                placeholder="Category name"
                required
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1.5px solid #90caf9',
                  padding: '10px 8px',
                  background: "#f6f8fa",
                  color: "#1976d2",
                  fontSize: 16
                }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Type</label>
              <select
                value={currentCategory.type}
                onChange={e => setCurrentCategory({
                  ...currentCategory,
                  type: e.target.value as 'income' | 'expense'
                })}
                required
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1.5px solid #90caf9',
                  padding: '10px 8px',
                  background: "#f6f8fa",
                  color: "#1976d2",
                  fontSize: 16
                }}
              >
                <option value="">Select type</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Color</label>
              <input
                type="color"
                className='colorPalate'
                value={currentCategory.color}
                style={{ width: 48, height: 32, border: 'none', background: 'transparent', marginTop: 8 }}
                onChange={e => setCurrentCategory({
                  ...currentCategory,
                  color: e.target.value
                })}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Icon</label>
              <input
                type="text"
                value={currentCategory.icon || ''}
                onChange={e => setCurrentCategory({
                  ...currentCategory,
                  icon: e.target.value
                })}
                placeholder="Ionicons icon name"
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1.5px solid #90caf9',
                  padding: '10px 8px',
                  background: "#f6f8fa",
                  color: "#1976d2",
                  fontSize: 16
                }}
              />
            </div>
          </div>
          <IonButton
            expand="block"
            color="primary"
            style={{
              borderRadius: 16,
              fontWeight: 600,
              marginTop: 10,
              width: '100%'
            }}
            type="submit"
          >
            Save
          </IonButton>
        </form>
      </Modal>

      {/* Delete Confirmation Modal (React Modal) */}
      <Modal
        isOpen={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
        contentLabel="Confirm Delete"
        style={{
          overlay: {
            backgroundColor: 'rgba(25,118,210,0.13)',
            zIndex: 1200,
            backdropFilter: 'blur(3px)'
          },
          content: {
            maxWidth: 340,
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
        <div style={{
          padding: 28,
          textAlign: 'center'
        }}>
          <h3 style={{ color: '#e53935', fontWeight: 700, marginBottom: 18 }}>
            Confirm Delete
          </h3>
          <p style={{ color: '#444', marginBottom: 24 }}>
            Are you sure you want to delete this category?
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button
              onClick={() => categoryToDelete && handleDeleteCategory(categoryToDelete)}
              style={{
                background: '#e53935',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 28px',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              Yes, Delete
            </button>
            <button
              onClick={() => setShowDeleteModal(false)}
              style={{
                background: '#e3f2fd',
                color: '#1976d2',
                border: 'none',
                borderRadius: 8,
                padding: '10px 28px',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Settings Modal (React Modal) */}
      <Modal
        isOpen={showSettingsModal}
        onRequestClose={() => setShowSettingsModal(false)}
        contentLabel="Privacy & Security"
        style={{
          overlay: {
            backgroundColor: 'rgba(25,118,210,0.13)',
            zIndex: 1300,
            backdropFilter: 'blur(3px)'
          },
          content: {
            maxWidth: 340,
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
          <h2 style={{ fontWeight: 700, fontSize: 20, color: '#1976d2', marginBottom: 18 }}>
            Privacy & Security
          </h2>
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
              <IonIcon icon={key} style={{ marginRight: 8, color: '#1976d2' }} />
              Set/Change Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter new password"
              style={{
                width: '100%',
                borderRadius: 8,
                border: '1.5px solid #90caf9',
                padding: '10px 8px',
                background: "#f6f8fa",
                color: "#1976d2",
                fontSize: 16
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <IonButton
                expand="block"
                color="primary"
                style={{ borderRadius: 12, fontWeight: 600, flex: 1 }}
                onClick={handleSavePassword}
              >
                Save Password
              </IonButton>
              <IonButton
                expand="block"
                color="danger"
                style={{ borderRadius: 12, fontWeight: 600, flex: 1 }}
                onClick={() => {
                  localStorage.removeItem('app_password');
                  toast.success('Password cleared!');
                  setPassword('');
                }}
              >
                Clear Password
              </IonButton>
            </div>

          </div>
          <div style={{ marginBottom: 22 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
              <IonIcon icon={eyeOff} style={{ marginRight: 8, color: '#e53935' }} />
              Show Incomes
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                checked={showIncome}
                onChange={e => {
                  setShowIncome(e.target.checked);
                  localStorage.setItem('show_income', e.target.checked.toString());
                }}
                style={{ width: 20, height: 20 }}
                id="showIncomeCheckbox"
              />
              <label htmlFor="showIncomeCheckbox" style={{ fontSize: 16, color: "#1976d2", fontWeight: 500 }}>
                {showIncome ? "Incomes are visible" : "Incomes are hidden"}
              </label>
            </div>
          </div>
          <IonButton
            expand="block"
            color="light"
            style={{ borderRadius: 12, fontWeight: 600, marginTop: 10 }}
            onClick={() => setShowSettingsModal(false)}
          >
            Close
          </IonButton>
        </div>
      </Modal>

      <Modal
        isOpen={showWebBackupModal}
        onRequestClose={() => setShowWebBackupModal(false)}
        contentLabel="Web Backup & Restore"
        style={{
          overlay: {
            backgroundColor: 'rgba(25,118,210,0.13)',
            zIndex: 1500,
            backdropFilter: 'blur(3px)'
          },
          content: {
            maxWidth: 420,
            width: '90vw',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            background: "#fff",
            borderRadius: 22,
            boxShadow: "0 8px 36px 0 rgba(25, 118, 210, 0.18)",
            padding: 0,
            border: 'none',
            minHeight: 0,
            overflow: 'visible'
          }
        }}
      >
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 18, width: '100%', maxWidth: 500 }}>
            {/* Toggle between Login and Register */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setWebMode('login')}
                style={{
                  padding: '8px 24px',
                  borderRadius: 20,
                  border: 'none',
                  background: webMode === 'login' ? '#1976d2' : '#e3f2fd',
                  color: webMode === 'login' ? '#fff' : '#1976d2',
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: webMode === 'login' ? '0 2px 8px #1976d233' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setWebMode('register')}
                style={{
                  padding: '8px 24px',
                  borderRadius: 20,
                  border: 'none',
                  background: webMode === 'register' ? '#1976d2' : '#e3f2fd',
                  color: webMode === 'register' ? '#fff' : '#1976d2',
                  fontWeight: 700,
                  fontSize: 16,
                  boxShadow: webMode === 'register' ? '0 2px 8px #1976d233' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Register
              </button>
            </div>
            <div style={{
              color: webMsg.includes('error') ? 'red' : 'green',
              marginTop: 12,
              fontWeight: 600,
              fontSize: 16,
              textAlign: 'center'
            }}>
              {webMsg}
            </div>
            <div
              style={{
                background: "linear-gradient(135deg, #e3f2fd 0%, #fff 100%)",
                padding: 20,
                borderRadius: 18,
                boxShadow: "0 4px 24px rgba(25,118,210,0.10)",
                width: '100%',
                maxWidth: 500,
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <h3 style={{
                marginBottom: 12,
                fontWeight: 700,
                fontSize: 22,
                color: '#1976d2',
                textAlign: 'center',
                letterSpacing: 1,
              }}>
                {webMode === 'login' ? 'Web Backup Login' : 'Web Backup Register'}
              </h3>
              <input
                type="number"
                placeholder="Phone Number"
                value={webUsername}
                onChange={e => setWebUsername(e.target.value)}
                style={{
                  marginBottom: 10,
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1.5px solid #90caf9',
                  fontSize: 17,
                  background: "#f6f8fa",
                  color: "#1976d2",
                  fontWeight: 500,
                }}
              />
              <input
                type="password"
                placeholder="Password"
                value={webPassword}
                onChange={e => setWebPassword(e.target.value)}
                style={{
                  marginBottom: 10,
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  border: '1.5px solid #90caf9',
                  fontSize: 17,
                  background: "#f6f8fa",
                  color: "#1976d2",
                  fontWeight: 500,
                }}
              />
              <IonButton
                color="primary"
                expand="block"
                onClick={webMode === 'login' ? handleWebLogin : handleWebRegister}
                disabled={webLoading}
                style={{
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 18,
                  marginTop: 8,
                  width: '100%',
                  boxShadow: "0 2px 8px #1976d233",
                }}
              >
                {webMode === 'login' ? 'Login' : 'Register'}
              </IonButton>
            </div>

          </div>
          <IonButton
            expand="block"
            color="light"
            style={{ borderRadius: 14, fontWeight: 600, marginTop: 10, width: '100%' }}
            onClick={() => setShowWebBackupModal(false)}
          >
            Close
          </IonButton>
        </div>
      </Modal>


      <style>
        {`
          .categoryFAB {
            z-index: 100;
          }
          @media (max-width: 700px) {
            .categories-header {
              max-width: 100vw !important;
              padding: 12px 2vw 12px 2vw !important;
            }
            .categories-responsive {
              max-width: 100vw !important;
              padding: 16px 2vw 16px 2vw !important;
            }
            .categoryFAB {
              right: 12px !important;
            }
          }
          @media (max-width: 500px) {
            .categories-header {
              padding: 8px 1vw 8px 1vw !important;
            }
            .categories-responsive {
              padding: 8px 1vw 8px 1vw !important;
            }
          }
          .categories-header input,
          .categories-header button,
          .categories-header .ion-button {
            font-size: 16px !important;
          }
          .categories-responsive .ion-item {
            font-size: 15px !important;
          }
          .colorful-spinner-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(255,255,255,0.35);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .colorful-spinner {
            width: 64px;
            height: 64px;
            border: 8px solid #e3f2fd;
            border-top: 8px solid #1976d2;
            border-right: 8px solid #ff6384;
            border-bottom: 8px solid #43a047;
            border-left: 8px solid #ffeb3b;
            border-radius: 50%;
            animation: colorful-spin 1.1s linear infinite;
          }
          @keyframes colorful-spin {
            0% { transform: rotate(0deg);}
            100% { transform: rotate(360deg);}
          }
        `}
      </style>
    </IonContent>
  </IonPage>
  );
};

export default Categories;