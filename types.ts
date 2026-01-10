
export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  status: 'Confirmed' | 'Pending';
  type: 'Income' | 'Expense' | 'Transfer' | 'Investment';
  amount: number;
  payment_method?: string;
  investment_id?: string;
  is_business?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'investment' | 'cash' | 'credit';
  balance: number;
  initial_balance_date: string;
  institution?: string;
  color?: string;
  lastDigits?: string;
  is_business?: boolean;
}

export interface Budget {
  category: string;
  planned: number;
  actual: number;
  icon: string;
  is_business?: boolean;
}

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  used: number;
  closingDay: number;
  dueDay: number;
  lastDigits: string;
  color: string;
  brand: 'Visa' | 'Mastercard' | 'Elo';
  is_business?: boolean;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  parent_id?: string | null;
  created_at?: string;
  is_business?: boolean;
}

export interface Product {
  id: string;
  user_id: string;
  code: string;
  name: string;
  category?: string;
  price: number;
  cost: number;
  is_active: boolean;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  cpf?: string;
  email?: string;
  phone?: string;
}

export interface Sale {
  id: string;
  user_id: string;
  external_code: string;
  customer_id?: string;
  date: string;
  time?: string;
  payment_method?: string;
  store_name?: string;
  device?: string;
  total_amount: number;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}
