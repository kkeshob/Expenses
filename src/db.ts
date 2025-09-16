import Dexie from 'dexie';
import 'dexie-observable';

export interface Category {
  id?: number;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

export interface Expense {
  id?: number;
  amount: number;
  category: string;
  description: string;
  date: Date;
  type: 'income' | 'expense';
  groupId?: number;
  paymentType?: 'cash' | 'credit' | 'e-cash'; // <-- Added field for payment type
}

export interface Account {
  id?: number;
  name: string;
  icon: string;
}

export class ExpenseDatabase extends Dexie {
  categories: Dexie.Table<Category, number>;
  expenses: Dexie.Table<Expense, number>;
  accounts: Dexie.Table<Account, number>;
  groups: any;

  constructor() {
    super('ExpenseDatabase', { addons: [Dexie.Observable] });

    // Upgrade to version 3: add accounts table and groupId to expenses
    this.version(3).stores({
      categories: '++id, &name, type',
      expenses: '++id, amount, category, description, date, type, groupId, paymentType', // <-- Added paymentType
      accounts: '++id,&name,icon'
    }).upgrade(tx => {
      // Add paymentType to existing expenses if needed (optional)
      return tx.table('expenses').toCollection().modify(exp => {
        if (exp.paymentType === undefined) exp.paymentType = 'cash';
      });
    });

    this.categories = this.table('categories');
    this.expenses = this.table('expenses');
    this.accounts = this.table('accounts');
  }
}

export const db = new ExpenseDatabase();

export async function initializeDB() {
  const categoriesCount = await db.categories.count();
  const accountsCount = await db.accounts.count();
  if (accountsCount === 0)  {
    // Add default account if none exist          
  await db.accounts.bulkAdd([
    { name: 'General Transections', icon: 'wallet' }]);
  }
  if (categoriesCount === 0) {
    await db.categories.bulkAdd([
      { name: 'General', type: 'expense', color: '#Ff00ff', icon: 'box' },
      { name: 'Food', type: 'expense', color: '#FF6384', icon: 'fast-food' },
      { name: 'Transport', type: 'expense', color: '#36A2EB', icon: 'car' },
      { name: 'Housing', type: 'expense', color: '#FFCE56', icon: 'home' },
      { name: 'Salary', type: 'income', color: '#4BC0C0', icon: 'cash' },
      { name: 'Bonus', type: 'income', color: '#9966FF', icon: 'gift' }
    ]);
  }
}


