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
interface CategoriesProps{
  marginTop:number;
}
const Categories: React.FC <CategoriesProps>= ({marginTop}) => {
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

  return (
    <IonPage style={{ paddingTop: marginTop }} >
      

      <IonContent style={{ background: "#f6f8fa" }}>
        {/* Fixed backup/restore block */}
        <div
          style={{
            position: 'fixed',
            top: 80,
            left: 0,
            right: 0,
            zIndex: 1000,
            maxWidth: 500,
            margin: "0 auto",
            padding: 16,
            background: "#fff",
            boxShadow: "0 4px 24px rgba(25,118,210,0.13)",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          
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

        {/* Add padding-top to avoid overlap with fixed block */}
        <div style={{ paddingTop: 200 }}>
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
             
              <IonList style={{ maxWidth: 500, margin: "0 auto" }}>
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
                        width: "95%", // <-- Set width to 95%
                        marginLeft: "auto",
                        marginRight: "auto"
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
                        width: "95%", // <-- Set width to 95%
                        marginLeft: "auto",
                        marginRight: "auto"
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

        <style>
          {`
            .categoryFAB {
              z-index: 100;
            }
          `}
        </style>
      </IonContent>
    </IonPage>
  );
};

export default Categories;