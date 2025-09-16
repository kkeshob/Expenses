import React, { useState, useEffect } from 'react';
import {
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonIcon,
  IonButtons,
  IonButton,
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonAvatar,
} from '@ionic/react';
import { trash, pencil } from 'ionicons/icons';
import { db, Expense, Category } from '../db';
import { toast } from 'react-toastify';
import Modal from 'react-modal';

interface ReportProps {
  marginTop: number;
}

const Report: React.FC<ReportProps> = ({ marginTop }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState<string>(new Date().toISOString());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [todayTotalExpense, setTodayTotalExpense] = useState(0);

  useEffect(() => {
    db.categories.toArray().then(setCategories);
  }, []);

  const getCategory = (name: string) => categories.find(cat => cat.name === name);

  const showIncome = localStorage.getItem('show_income') === null
    ? true
    : localStorage.getItem('show_income') === 'true';

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toLocaleDateString('en-IN'); // "DD/MM/YYYY"
      let allExpenses = await db.expenses.toArray();

      // Filter by system date (Indian format)
      allExpenses = allExpenses.filter(exp => {
        const expDateStr = exp.date
          ? new Date(exp.date).toLocaleDateString('en-IN')
          : '';
        return expDateStr === todayStr;
      });

      if (searchText) {
        allExpenses = allExpenses.filter(exp =>
          exp.description.toLowerCase().includes(searchText.toLowerCase()) ||
          exp.category.toLowerCase().includes(searchText.toLowerCase())
        );
      }

      const filteredExpenses = showIncome
        ? allExpenses
        : allExpenses.filter(exp => exp.type !== 'income');

      setExpenses(filteredExpenses);

      const total = filteredExpenses
        .filter(e => e.type === 'expense')
        .reduce((sum, e) => sum + e.amount, 0);
      setTodayTotalExpense(total);

    } catch (error) {
      toast.error(`Error loading expenses: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteExpense = (expense: Expense) => {
    setDeletingExpense(expense);
    setDeleteModalOpen(true);
  };

  const deleteExpense = async () => {
    if (!deletingExpense) return;
    try {
      await db.expenses.delete(deletingExpense.id!);
      setExpenses(expenses.filter(exp => exp.id !== deletingExpense.id));
      toast.success('Transaction deleted successfully');
    } catch (error) {
      toast.error(`Error deleting transaction: ${error}`);
    } finally {
      setDeleteModalOpen(false);
      setDeletingExpense(null);
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
      loadExpenses();
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
  }, [searchText]);

  useEffect(() => {
    const handler = () => loadExpenses();
    db.on('changes', handler);
    return () => db.on('changes').unsubscribe(handler);
    // eslint-disable-next-line
  }, []);

  return (
    <IonPage style={{ paddingTop: marginTop }}>
      <IonContent className="ion-padding" style={{ background: "#f6f8fa" }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{
          position: 'sticky',
          top: -70,
          zIndex: 20,
          background: '#fff',
          paddingBottom: 8,
          paddingTop: 8
        }}>
          <IonSearchbar
            value={searchText}
            onIonChange={e => setSearchText(e.detail.value!)}
            onIonClear={() => setSearchText('')}
            debounce={400}
            placeholder="Search today's transactions"
            style={{
              borderRadius: 16,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              background: "#fff",
              marginBottom: 8
            }}
          />
          <div style={{
            boxShadow: "0 5px 20px rgba(0,0,0,0.06)",
            margin: "0 0 12px 0",
            padding: "18px 18px 12px 18px",
            maxWidth: 420,
            marginLeft: "auto",
            marginRight: "auto"
          }}>
            <p style={{
              margin: 0,
              marginBottom: 10,
              fontWeight: 700,
              color: "#222",
              fontSize: 18,
              letterSpacing: 1
            }}>
              Today's Total Expenses =
              <span style={{
                fontSize: 18,
                color: "#e53935",
                fontWeight: 600
              }}>
                ₹ {todayTotalExpense.toFixed(2)}
              </span>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>Loading...</IonLabel>
          </div>
        ) : expenses.length === 0 ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>No transactions recorded today</IonLabel>
          </div>
        ) : (
          <IonList lines="none">
            {expenses.map(expense => {
              if (!showIncome && expense.type === 'income') return null;
              const cat = getCategory(expense.category);
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
                    minHeight: 'auto',
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
                    }} />
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
                          maxWidth: '60%'
                        }}>
                          {expense.category}
                        </span>
                        <span style={{
                          fontSize: 12,
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
                        }}>
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
                          {new Date(expense.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </IonNote>
                      </div>
                      {/* Show payment type if present */}
                      {expense.paymentType && (
                        <div style={{
                          color: "#e53935",
                          fontWeight: 700,
                          fontSize: 13,
                          display: "inline-block",
                          width: "fit-content"
                        }}>
                          {expense.paymentType === 'cash' && 'Cash'}
                          {expense.paymentType === 'credit' && 'Credit'}
                          {expense.paymentType === 'e-cash' && 'E-Cash'}
                        </div>
                      )}
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
            <div className='extraSpace'></div>
          </IonList>
        )}

        {/* Edit Expense Modal */}
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
              <div style={{ background: '#fff', padding: 8 }}>
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
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
                marginTop: 8,
                marginBottom: 20,
                paddingBottom: 20
              }}>
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
                onClick={deleteExpense}
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

export default Report;