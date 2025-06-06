import React, { useState, useEffect, useMemo } from 'react';
import { Category, db } from '../db';
import { toast, ToastContainer } from 'react-toastify';
import Modal from 'react-modal';
import Select from 'react-select';

Modal.setAppElement('#root');

interface ExpenseFormModalProps {
  isOpen: boolean;
  onRequestClose: () => void;
  onExpenseAdded?: () => void;
  
}

const ExpenseFormModal: React.FC<ExpenseFormModalProps> = ({
  isOpen,
  onRequestClose,
  onExpenseAdded
}) => {
  const [amount, setAmount] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString());
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [modalTop, setModalTop] = useState('40%');
  const [modalHeeight, setModalHeight] = useState('58vh');


  // Load categories only once
  useEffect(() => {
    let mounted = true;
    db.categories.toArray().then(cats => {
      if (mounted) setCategories(cats);
    });
    return () => { mounted = false; };
  }, []);

  // Memoize filtered categories for performance
  const filteredCategories = useMemo(
    () => categories.filter(cat => cat.type === type),
    [categories, type]
  );

  // Set default category to "General" if exists for the selected type
  useEffect(() => {
    const generalCat = filteredCategories.find(cat => cat.name === 'General');
    if (generalCat) {
      setCategory(generalCat);
    } else if (filteredCategories.length > 0) {
      setCategory(filteredCategories[0]);
    } else {
      setCategory(null);
    }
  }, [type, categories]);





  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount);

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.warning('Amount must be greater than 0');
      return;
    }

    if (!category) {
      toast.warning('Please select a category');
      return;
    }

    // 2. Get groupId: use selectedGroupId or fallback to default from localStorage
    let groupId = Number(
      localStorage.getItem('selectedGroupId')
    );
    if (!groupId) {
      // Try to get default group from localStorage
     
      groupId = 1;
    }

    try {
      // 3. Save transaction with groupId
      await db.expenses.add({
        amount: parsedAmount,
        category: category.name,
        description,
        date: new Date(date),
        type,
        groupId
      });

      // Optionally, also save to localStorage for quick acc

      setAmount('');
      setDescription('');
      setDate(new Date().toISOString());
      setType('expense');
      toast.success('Expense added successfully!');
      if (onExpenseAdded) onExpenseAdded();
      onRequestClose();
    } catch (error) {
      toast.error(`Error adding ${type === 'income' ? 'income' : 'expense'}: ${error}`);
    }
  };
  const loadCategories = (): void => {
    db.categories.toArray().then(cats => {
      setCategories(cats);
    }).catch(error => {
      toast.error(`Error loading categories: ${error}`);
    });   
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onRequestClose={onRequestClose}
        contentLabel="Add Expense"
        style={{
          overlay: {
            backgroundColor: 'rgba(33,33,33,0.18)',
            zIndex: 1000,
            backdropFilter: 'blur(10px)'
          },
          content: {
            maxWidth: 420,
            width: '92vw',
            top: modalTop,
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 8px 32px 0 rgba(33,33,33,0.18)",
            padding: 0,
            border: 'none',
            minHeight: 0,
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <div
          style={{
            maxHeight: modalHeeight,
            paddingBottom: 80,
            zIndex: 1000 // extra space for keyboard
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              maxWidth: 420,
              margin: '0 auto',
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 2px 12px rgba(0,0,0,0.09)",
              padding: 0,
              paddingTop: 0,
              paddingBottom: 0,
              zIndex: 2000
            }}
          >
            {/* Android-style App Bar */}
            <div style={{
              background: '#1976d2',
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: '16px 0 12px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(25,118,210,0.09)'
            }}>
              <button
                type="button"
                onClick={onRequestClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: 20,
                  padding: '0 18px',
                  cursor: 'pointer'
                }}
                aria-label="Close"
              >
                &#10005;
              </button>
              <span style={{
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: 0.5,
                flex: 1,
                textAlign: 'center',
                marginRight: 36 // space for close button
              }}>
                Add {type === 'income' ? 'Income' : 'Expense'}
              </span>
            </div>

            <div style={{ padding: 18, paddingTop: 10 }}>
              {/* Transaction Type Toggle */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 18,
                gap: 8
              }}>
                <button
                  type="button"
                  style={{
                    borderRadius: 24,
                    fontWeight: 600,
                    letterSpacing: 1,
                    minWidth: 120,
                    background: type === 'expense' ? '#e53935' : '#e0e0e0',
                    color: type === 'expense' ? '#fff' : '#222',
                    border: 'none',
                    padding: '10px 0',
                    cursor: 'pointer',
                    boxShadow: type === 'expense' ? '0 2px 8px #e5393533' : undefined
                  }}
                  onClick={() => setType('expense')}
                >
                  Expense
                </button>
                <button
                  type="button"
                  style={{
                    borderRadius: 24,
                    fontWeight: 600,
                    letterSpacing: 1,
                    minWidth: 120,
                    background: type === 'income' ? '#43a047' : '#e0e0e0',
                    color: type === 'income' ? '#fff' : '#222',
                    border: 'none',
                    padding: '10px 0',
                    cursor: 'pointer',
                    boxShadow: type === 'income' ? '0 2px 8px #43a04733' : undefined
                  }}
                  onClick={() => setType('income')}
                >
                  Income
                </button>
              </div>

              {/* Amount */}
              <div style={{
                borderRadius: 12,
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: 10
              }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6, color: '#222' }}>Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="Enter amount"
                  inputMode="decimal"
                  style={{
                    fontWeight: 600,
                    fontSize: 18,
                    width: '100%',
                    borderRadius: 8,
                    border: '1.5px solid #90caf9',
                    padding: '10px 8px',
                    background: "#f6f8fa",
                    color: "#1976d2"
                  }}
                  onFocus={() => setModalTop('32%')}
                  onBlur={() => setModalTop('40%')}
                />
              </div>

              {/* Category */}
              <div style={{
                borderRadius: 12,
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: 10
              }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6, color: '#222' }}>Category</label>
                <Select
                  value={category}
                  onChange={option => setCategory(option as Category)}
                  options={filteredCategories}
                  getOptionLabel={cat => cat.name}
                  getOptionValue={cat => cat.name}
                  onFocus={() => { 
                    loadCategories();
                     setModalTop('38%');
                     setModalHeight('100vh');
                  }}
                  styles={{
                    container: base => ({
                      ...base,
                      width: '100%',
                      marginTop: 8,
                      marginBottom: 8,
                      border: '1.5px solid #90caf9',
                      borderRadius: 8,
                      background: "#f6f8fa"
                    })
                  }}
                  placeholder="Select category"
                  isSearchable={false}
           
                  onBlur={() => {setModalTop('40%');setModalHeight('58vh');}}
                />
              </div>

              {/* Description */}
              <div style={{
                borderRadius: 12,
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: 10
              }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6, color: '#222' }}>Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
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
                  onFocus={() => setModalTop('32%')}
                  onBlur={() => setModalTop('40%')}
                />
              </div>

              {/* Date */}
              <div style={{
                borderRadius: 12,
                width: '100%',
                boxSizing: 'border-box',
                marginBottom: 10
              }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6, color: '#222' }}>Date</label>
                <input
                  type="date"
                  value={date.slice(0, 10)}
                  onChange={e => setDate(new Date(e.target.value).toISOString())}
                  style={{
                    width: '100%',
                    borderRadius: 8,
                    border: '1.5px solid #90caf9',
                    padding: '10px 8px',
                    fontSize: 16,
                    background: "#f6f8fa",
                    color: "#1976d2"
                  }}

                  onBlur={() => setModalTop('40%')}
                />
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 18
              }}>
                <button
                  type="button"
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 16,
                    background: "#e0e0e0",
                    color: "#1976d2",
                    border: 'none',
                    padding: '10px 22px',
                    cursor: 'pointer'
                  }}
                  onClick={onRequestClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 16,
                    background: "#1976d2",
                    color: "#fff",
                    border: 'none',
                    padding: '10px 22px',
                    cursor: 'pointer'
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </form>
        </div>
        <style>
          {`
            @media (max-width: 600px) {
              .ReactModal__Content {
                max-height: 90vh !important;
              }
            }
            form {
              transition: box-shadow 0.2s;
            }
            form:focus-within {
              box-shadow: 0 4px 24px rgba(25,118,210,0.13);
            }
            input, textarea, select {
              font-family: Roboto, Arial, sans-serif;
            }
          `}
        </style>
      </Modal>
    </>
  );
};

export default ExpenseFormModal;