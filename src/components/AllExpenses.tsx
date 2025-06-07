import React, { useState, useEffect } from 'react';
import {
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonBadge,
  IonIcon,
  IonButtons,
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonAvatar,
  IonModal,
  IonInput,
  IonDatetime,
  IonText
} from '@ionic/react';
import { trash, pencil, calendarOutline, funnelOutline, reloadCircleOutline, closeCircleSharp } from 'ionicons/icons';
import { db, Expense, Category } from '../db';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-modal';

interface AllExpensesProps {
  selectedGroupId: number | null;
  marginTop:number;
}

const AllExpenses: React.FC<AllExpensesProps> = ({ selectedGroupId, marginTop }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [resultText, setResultText] = useState('');
  // REMOVE: const [present] = useIonToast();

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState<string>(new Date().toISOString());
  const [showDateModal, setShowDateModal] = useState(false);
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  let currentGroupId = Number(localStorage.getItem('selectedGroupId'));


  // Add group filter state
  const [selectedGroup, setSelectedGroup] = useState<number | ''>('');

  // Date filter state
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Add new state for single date filter
  const [singleDate, setSingleDate] = useState<string>('');
  const [singleDateFilterOpen, setSingleDateFilterOpen] = useState(false);




  // Read showIncome from localStorage on every render
  const showIncome = localStorage.getItem('show_income') === null
    ? true
    : localStorage.getItem('show_income') === 'true';




  // Handler for delete confirmation modal
  const handleDeleteExpense = async () => {
    if (deletingExpense && deletingExpense.id !== undefined) {
      await deleteExpense(deletingExpense.id);
      setDeleteModalOpen(false);
      setDeletingExpense(null);
      await loadExpenses(); // <-- reload after delete
    }
  };

  // Fetch categories and accounts (groups)
  useEffect(() => {
    db.categories.toArray().then(setCategories);
    db.accounts.toArray().then(accs => setAccounts(accs.map(a => ({ id: a.id!, name: a.name }))));
  }, []);

  const getCategory = (name: string) => categories.find(cat => cat.name === name);

  // Helper to get group name by id
  const getGroupName = (groupId: number | null | undefined) => {
    if (!groupId) return '';
    const group = accounts.find(acc => acc.id === groupId);
    return group ? group.name : '';
  };

  // Filter and load expenses by search, category, and group
  const loadExpenses = async () => {
    setLoading(true);
    try {
      let allExpenses = await db.expenses.toArray();

      // Filter by group if selected
      if (selectedGroup !== '') {
        allExpenses = allExpenses.filter(exp => exp.groupId === selectedGroup);

      }

      // Filter by category if selected
      if (selectedCategory) {
        allExpenses = allExpenses.filter(exp => exp.category === selectedCategory);
      }

      // Filter by search text
      if (searchText) {
        const search = searchText.toLowerCase();
        allExpenses = allExpenses.filter(
          exp =>
            (exp.description && exp.description.toLowerCase().includes(search)) ||
            (exp.category && exp.category.toLowerCase().includes(search))
        );
      }

      // Only apply one date filter at a time
      if (singleDate) {
        allExpenses = allExpenses.filter(
          exp => new Date(exp.date).toISOString().slice(0, 10) === singleDate
        );
        setResultText(
          `Showing transactions for Date :  ${new Date(singleDate).toLocaleDateString()}`
        );

      } else if (dateFrom || dateTo) {
        if (dateFrom) {
          allExpenses = allExpenses.filter(exp => new Date(exp.date) >= new Date(dateFrom));
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setDate(toDate.getDate() + 2);
          allExpenses = allExpenses.filter(exp => new Date(exp.date) < toDate);
        }
        setResultText(
          `Showing transactions from ${dateFrom ? new Date(dateFrom).toLocaleDateString() : ''} 
          to ${dateTo ? new Date(dateTo).toLocaleDateString() : ''}`
        );
      } else if (searchText || selectedCategory || selectedGroup) {
        setResultText(
          `Showing transactions for ${selectedCategory ? selectedCategory : 'All Categories'} 
          ${selectedGroup ? `in Group: ${getGroupName(selectedGroup)}` : ''} 
          ${searchText ? `matching: "${searchText}"` : ''}`
        );      
      } else {
        setResultText('');
      }

      setExpenses(allExpenses);
    } catch (error) {
      toast.error(`Error loading expenses: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async (id: number) => {
    try {
      await db.expenses.delete(id);
      setExpenses(expenses.filter(exp => exp.id !== id));
      toast.success('Transaction deleted successfully');
    } catch (error) {
      toast.error(`Error deleting transaction: ${error}`);
    }
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setEditAmount(expense.amount);
    setEditDescription(expense.description ?? '');
    setEditCategory(expense.category);
    setEditDate(typeof expense.date === 'string' ? expense.date : new Date(expense.date).toISOString());
    setEditModalOpen(true);
  };

  // Reload expenses when filters change
  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line
  }, [searchText, selectedCategory, selectedGroup]);

  // Reload expenses when Dexie DB changes (add/edit/delete)
  useEffect(() => {
    const handler = () => loadExpenses();
    db.on('changes', handler);
    return () => db.on('changes').unsubscribe(handler);
    // eslint-disable-next-line
  }, []);

  // Reload expenses after editing or deleting
  const handleEditSave = async () => {
    if (!editingExpense) return;
    if (editAmount <= 0) {
      toast.warning('Amount must be greater than 0');
      return;
    }
    try {
      await db.expenses.update(editingExpense.id!, {
        amount: editAmount,
        description: editDescription,
        category: editCategory,
        date: new Date(editDate)
      });
      toast.success('Transaction updated successfully');
      setEditModalOpen(false);
      setEditingExpense(null);
      await loadExpenses(); // <-- reload after edit
    } catch (error) {
      toast.error(`Error updating transaction: ${error}`);
    }
  };

  const handleRefresh = (event: CustomEvent) => {
    loadExpenses().then(() => {
      event.detail.complete();
    });
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line
  }, [searchText, selectedCategory]);

  useEffect(() => {
    const handler = () => loadExpenses();
    db.on('changes', handler);
    return () => db.on('changes').unsubscribe(handler);
    // eslint-disable-next-line
  }, []);

  // Filtered expenses: hide income transactions if showIncome is false
  const filteredExpenses = showIncome
    ? expenses
    : expenses.filter(exp => exp.type !== 'income');

  // Only sum expenses (not income)
  const totalFilteredExpenses = filteredExpenses
    .filter(exp => exp.type === 'expense')
    .reduce((sum, exp) => sum + exp.amount, 0);

  // Calculate net balance (income - expenses), but hide if showIncome is false
  const totalIncome = filteredExpenses
    .filter(exp => exp.type === 'income')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const netBalance = showIncome ? (totalIncome - totalFilteredExpenses) : null;

  return (
    <IonPage style={{ paddingTop: marginTop }}>
      <IonContent className="ion-padding" style={{ background: "#f6f8fa" }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div
          style={{
            position: 'sticky',
            top: -55,
            zIndex: 10,
            display: 'block',
            background: '#fff',
            marginBottom: 8
          }}
        >
          <div 
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <IonSearchbar
              value={searchText}
              onIonChange={e => setSearchText(e.detail.value!)}
              onIonClear={() => setSearchText('')}
              debounce={300}
              placeholder="Search"
              style={{
                borderRadius: 16,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                background: "#fff",
                marginBottom: 0,
                flex: 2,

              }}
              showClearButton="always"
              showCancelButton="focus"
            />

          </div>





            <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            width:'100%',
            alignItems: 'center',
            background: '#f6f8fa'
          }}>

              <IonButton
                size="small"
                color="primary"
                onClick={() => setSingleDateFilterOpen(true)}
                className='filterButtons'
              >
                <IonIcon icon={funnelOutline} style={{ marginRight: 8 }} /> Single Date
              </IonButton>



              <IonButton
                size="small"
                color="primary"
                onClick={() => setDateFilterOpen(true)}
                className='filterButtons'
              >
                <IonIcon icon={funnelOutline} style={{ marginRight: 8 }} /> Date Range
              </IonButton>





              <div className='filterButtonsSelect'>
                <IonSelect
                  value={selectedGroup}
                  placeholder="Group"
                  onIonChange={e => setSelectedGroup(e.detail.value)}
                  interface="popover"
                  style={{
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 500
                  }}
                >
                  <IonSelectOption value="">Groups</IonSelectOption>
                  {accounts.map(acc => (
                    <IonSelectOption key={acc.id} value={acc.id}>
                      {acc.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </div>
              <div className='filterButtonsSelect'>
                <IonSelect
                  value={selectedCategory}
                  placeholder="Category"
                  onIonChange={e => setSelectedCategory(e.detail.value)}
                  interface="popover"
                  color={'primary'}
                  style={{

                    color: "#fff",
                    fontSize: 15,
                    marginLeft: 8,
                    fontWeight: 500
                  }}
                >
                  <IonSelectOption value="">Categories</IonSelectOption>
                  {categories.map(cat => (
                    <IonSelectOption key={cat.id} value={cat.name}>
                      <IonIcon icon={cat.icon} style={{ color: cat.color, marginRight: 8 }} /> {cat.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </div>



            </div>






          <div className='filterAreaText' style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, marginBottom: 8 }}>
   
           
            <button
              
              onClick={() => {
                setSearchText('');
                setSelectedCategory('');
                setSelectedGroup('');
                setSingleDate('');
                setDateFrom('');
                setDateTo('');
                setResultText('');
                loadExpenses();
              }}
              style={{ background:'#fff', height: 5, width:30, borderRadius: '50%', flex: 1 }}
            >
              <IonIcon icon={closeCircleSharp} style={{ color: "#ff0000", fontSize: 30 }} />
            </button>

                     <span style={{  marginTop:-40,marginLeft:30,fontSize: 16, color: "#e53935", fontWeight: 800, textAlign: 'center', flex: 1 }}>
              Sum of Filtered Transections = ₹ {totalFilteredExpenses.toFixed(2)}
            </span>
          </div>

        </div>

        {loading ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>Loading...</IonLabel>
          </div>
        ) : expenses.length === 0 ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>No transactions recorded yet</IonLabel>
          </div>
        ) : (
          <>
            <center>
              <IonText color="primary" style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                {resultText || 'All Transactions'}
              </IonText>
            </center>
            <br/>
            <IonList lines="none">
              {filteredExpenses.map(expense => {
                if(!showIncome && expense.type === 'income') return null; // Skip income if showIncome is false
                const cat = getCategory(expense.category);
                function confirmDeleteExpense(expense: Expense): void {
                  setDeletingExpense(expense);
                  setDeleteModalOpen(true);
                }
                return (
                  <IonItem
                    key={expense.id}
                    style={{
                      borderRadius: 14,
                      marginBottom: 12,
                      boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
                      background: "#fff",
                      borderLeft: `6px solid ${cat?.color || "#ccc"}`,
                      transition: "box-shadow 0.2s",
                      alignItems: 'center',
                      minHeight: 64,
                      padding: 0
                    }}
                    className="expense-card"
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      padding: '5px 0'
                    }}>
                      <IonAvatar slot="start" style={{
                        background: cat?.color || "#eee",
                        marginLeft: -12,
                        marginRight: 12,
                        width: 30,
                        height: 30,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IonIcon icon={cat?.icon} style={{ color: "#fff", fontSize: 24 }} />
                      </IonAvatar>
                      <div style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%'
                        }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: 16,
                            color: "#222",
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '60%'
                          }}>
                            {expense.category}
                          </span>
                          <span
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              padding: '4px 14px',
                              borderRadius: 6,
                              marginLeft: 8,
                              backgroundColor: expense.type === 'income'
                                ? 'var(--ion-color-success, #43a047)'
                                : 'var(--ion-color-danger, #e53935)',
                              color: '#fff',
                              minWidth: 90,
                              textAlign: 'right',
                              letterSpacing: 0.5
                            }}
                          >
                            {expense.type === 'income' ? '+' : '-'}₹{expense.amount.toFixed(2)}
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 2
                        }}>
                          <span style={{
                            color: "#666",
                            fontSize: 14,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '70%'
                          }}>
                            {expense.description}
                          </span>
                          <IonNote style={{
                            fontSize: 12,
                            color: "#888",
                            marginLeft: 8,
                            minWidth: 60,
                            textAlign: 'right'
                          }}>
                            {new Date(expense.date).toLocaleDateString()}
                          </IonNote>
                        </div>
                        {/* Show group name */}
                        <div style={{
                          color: "#1976d2",
                          fontSize: 13,
                          marginTop: 2,
                          fontWeight: 500
                        }}>
                          {getGroupName(expense.groupId)}
                        </div>
                      </div>
                      <IonButtons slot="end" style={{ marginLeft: 8, alignSelf: 'flex-start' }}>
                        <IonButton
                          color="medium"
                          onClick={() => openEditModal(expense)}
                          style={{ marginRight: 2 }}
                        >
                          <IonIcon icon={pencil} />
                        </IonButton>
                        <IonButton
                          color="danger"
                          onClick={() => confirmDeleteExpense(expense)}
                        >
                          <IonIcon icon={trash} />
                        </IonButton>
                      </IonButtons>
                    </div>
                  </IonItem>
                );
              })}
            </IonList>

            <div className='extraSpace'></div>
          </>
        )}
        {/* Edit Expense Modal (React Modal) */}
        <Modal
          isOpen={editModalOpen}
          onRequestClose={() => setEditModalOpen(false)}
          contentLabel="Edit Transaction"
          style={{
            overlay: {
              backgroundColor: 'rgba(25,118,210,0.13)',
              zIndex: 1000,
              backdropFilter: 'blur(3px)'
            },
            content: {
              maxWidth: '95vw',
              width: '95vw',
              top: '40%',
              left: '50%',
              right: 'auto',
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
              background: "linear-gradient(135deg, #f6f8fa 0%, #e3f2fd 100%)",
              borderRadius: 22,
              boxShadow: "0 8px 36px 0 rgba(25, 118, 210, 0.18)",
              padding: 20,
              border: 'none',
              minHeight: 0,
              overflow: 'visible'
            }
          }}
        >
          <div style={{
            maxWidth: 420,
            margin: '0 auto',
            borderRadius: 18,
            background: 'var(--ion-background-color, #f6f8fa)'
          }}>
            <div style={{
              fontWeight: 700,
              letterSpacing: 1,
              fontSize: 22,

              marginBottom: 18,
              color: '#1976d2',
              textAlign: 'center'
            }}>Edit Transaction</div>
            <form
              onSubmit={e => {
                e.preventDefault();
                handleEditSave();
              }}
              style={{ maxWidth: 400, margin: '0 auto' }}
            >
              <div style={{
                background: '#fff',
                padding: 8
              }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Amount</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(parseFloat(e.target.value) || 0)}
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Enter amount"
                  style={{ color: '#222', width: '100%', borderRadius: 8, border: '1.5px solid #90caf9', padding: '10px 8px', background: "#f6f8fa" }}
                />
              </div>
              <div style={{ background: '#fff', padding: 8 }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: '1.5px solid #90caf9',
                    fontWeight: 500,
                    background: "#f6f8fa",
                    fontSize: 16,
                    color: "#1976d2"
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ background: '#fff', padding: 10 }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Add a note (optional)"
                  style={{
                    fontWeight: 500,
                    fontSize: 16,
                    width: '100%',
                    borderRadius: 8,
                    border: '1.5px solid #90caf9',
                    padding: '10px 8px',
                    background: "#f6f8fa",
                    color: "#1976d2",
                    resize: 'vertical'
                  }}
                />
              </div>
              <div style={{ background: '#fff', padding: 8 }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Date</label>
                <input
                  type="date"
                  value={editDate.slice(0, 10)}
                  onChange={e => setEditDate(new Date(e.target.value).toISOString())}
                  style={{
                    width: '100%',
                    borderRadius: 8,
                    border: '1.5px solid #90caf9',
                    padding: '10px 8px',
                    fontSize: 16,
                    background: "#f6f8fa",
                    color: "#1976d2"
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8, marginBottom: 20, paddingBottom: 20 }}>
                <button
                  type="submit"
                  style={{
                    borderRadius: 20,
                    fontWeight: 700,
                    letterSpacing: 1,
                    fontSize: 18,
                    width: '60%',
                    boxShadow: "0 2px 8px #1976d233",
                    background: "#1976d2",
                    color: "#fff",
                    border: 'none',
                    padding: '12px 0',
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  style={{
                    borderRadius: 20,
                    fontWeight: 700,
                    letterSpacing: 1,
                    fontSize: 18,
                    width: '30%',
                    background: "#e3f2fd",
                    color: "#1976d2",
                    border: 'none',
                    padding: '12px 0',
                    cursor: 'pointer'
                  }}
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModalOpen}
          onRequestClose={() => setDeleteModalOpen(false)}
          contentLabel="Confirm Delete"
          style={{
            overlay: {
              backgroundColor: 'rgba(25,118,210,0.13)',
              zIndex: 1100,
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
              Are you sure you want to delete this transaction?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button
                onClick={handleDeleteExpense}
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
                onClick={() => setDeleteModalOpen(false)}
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

        {/* Single Date Filter Modal */}
        <Modal
          isOpen={singleDateFilterOpen}
          onRequestClose={() => setSingleDateFilterOpen(false)}
          contentLabel="Filter by Single Date"
          style={{
            overlay: {
              backgroundColor: 'rgba(25,118,210,0.13)',
              zIndex: 1200,
              backdropFilter: 'blur(2px)'
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
              padding: 24,
              border: 'none',
              minHeight: 0,
              overflow: 'visible'
            }
          }}
        >
          <h3 style={{ color: '#1976d2', fontWeight: 700, marginBottom: 18, textAlign: 'center' }}>
            Filter by Single Date
          </h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Date</label>
            <input
              type="date"
              value={singleDate}
              onChange={e => setSingleDate(e.target.value)}
              style={{
                width: '100%',
                borderRadius: 8,
                border: '1.5px solid #90caf9',
                padding: '10px 8px',
                fontSize: 16,
                background: "#f6f8fa",
                color: "#1976d2"
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <IonButton
              color="primary"
              onClick={() => {
                setSingleDateFilterOpen(false);
                setDateFrom(''); // Clear range
                setDateTo('');
                loadExpenses();
              }}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Apply
            </IonButton>
            <IonButton
              color="medium"
              onClick={() => {
                setSingleDate('');
                setSingleDateFilterOpen(false);
                loadExpenses();
              }}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Clear
            </IonButton>
          </div>
        </Modal>

        {/* Date Range Filter Modal */}
        <Modal
          isOpen={dateFilterOpen}
          onRequestClose={() => setDateFilterOpen(false)}
          contentLabel="Filter by Date"
          style={{
            overlay: {
              backgroundColor: 'rgba(25,118,210,0.13)',
              zIndex: 1200,
              backdropFilter: 'blur(2px)'
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
              padding: 24,
              border: 'none',
              minHeight: 0,
              overflow: 'visible'
            }
          }}
        >
          <h3 style={{ color: '#1976d2', fontWeight: 700, marginBottom: 18, textAlign: 'center' }}>
            Filter by Date Range
          </h3>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                width: '100%',
                borderRadius: 8,
                border: '1.5px solid #90caf9',
                padding: '10px 8px',
                fontSize: 16,
                background: "#f6f8fa",
                color: "#1976d2"
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                width: '100%',
                borderRadius: 8,
                border: '1.5px solid #90caf9',
                padding: '10px 8px',
                fontSize: 16,
                background: "#f6f8fa",
                color: "#1976d2"
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <IonButton
              color="primary"
              onClick={() => {
                setDateFilterOpen(false);
                setSingleDate(''); // Clear single date
                loadExpenses();
              }}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Apply
            </IonButton>
            <IonButton
              color="medium"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setDateFilterOpen(false);
                loadExpenses();
              }}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Clear
            </IonButton>
          </div>
        </Modal>


        <style>
          {`
            .expense-card:hover {
              box-shadow: 0 4px 24px rgba(0,0,0,0.13);
              transform: translateY(-2px);
            }
          `}
        </style>

      </IonContent>


    </IonPage>
  );
};

export default AllExpenses;