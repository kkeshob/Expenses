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
  groupId?: number; // <-- Add groupId for expense grouping
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

  constructor() {
    super('ExpenseDatabase', { addons: [Dexie.Observable] });

    // Upgrade to version 2: add accounts table and groupId to expenses
    this.version(2).stores({
      categories: '++id, &name, type',
      expenses: '++id, amount, category, description, date, type, groupId',
      accounts: '++id,&name,icon'
    }).upgrade(tx => {
      // Add groupId to existing expenses if needed (optional)
      return tx.table('expenses').toCollection().modify(exp => {
        if (exp.groupId === undefined) exp.groupId = null;
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


