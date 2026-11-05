import { MongoClient, Db, Collection } from 'mongodb';

export interface UserDoc {
  id: string;
  name: string;
  idt: string; // 'email' | 'phone' | 'id'
  idv: string; // normalized value
  salt: string;
  hash: string;
  rs?: string;
  rh?: string;
  at: number;
}

export interface UserDataDoc {
  userId: string;
  tx: any[];
  cats: string[];
  budgets: Record<string, number>;
  strict?: Record<string, boolean>;
  overall: number;
  hard: boolean;
  ef: any[];
  efTarget: number;
  goals: any[];
  imports: any[];
  trash: any[];
  parents: any[];
  theme?: string;
  lang?: string;
  custom?: { nv: string; ac: string; bg: string };
  profile?: any;
  updatedAt: number;
}

let client: MongoClient | null = null;
let db: Db | null = null;
let isConnected = false;
let lastError: string | null = null;

// Fallback in-memory store if MONGODB_URI is not yet configured by user
const memoryUsers = new Map<string, UserDoc>();
const memoryData = new Map<string, UserDataDoc>();

export async function connectDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('username:password@cluster.mongodb.net')) {
    lastError = 'MONGODB_URI is not configured yet or has placeholder credentials.';
    console.log('[MongoDB] Notice: MONGODB_URI is not configured in environment yet. Backend is running in memory fallback mode.');
    console.log('[MongoDB] To connect MongoDB Atlas on Render, set MONGODB_URI="mongodb+srv://..." in Render Environment Variables.');
    isConnected = false;
    return false;
  }

  try {
    lastError = null;
    if (client) {
      try {
        await client.close();
      } catch {}
      client = null;
    }

    console.log('[MongoDB] Connecting to MongoDB...');
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    await client.connect();

    // Use database specified in the URI connection string if present, or fallback to 'studentspend'
    const targetDbName = client.options?.dbName || 'studentspend';
    db = client.db(targetDbName);
    isConnected = true;
    console.log(`[MongoDB] Connected successfully to database: ${targetDbName}`);

    // Create indexes safely (non-blocking)
    try {
      const usersCol = db.collection<UserDoc>('users');
      await usersCol.createIndex({ id: 1 }, { unique: true });
      await usersCol.createIndex({ idv: 1 }, { unique: true });

      const dataCol = db.collection<UserDataDoc>('userdata');
      await dataCol.createIndex({ userId: 1 }, { unique: true });
    } catch (idxErr) {
      console.warn('[MongoDB] Index creation note (non-fatal):', idxErr);
    }

    return true;
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error('[MongoDB] Connection error:', msg);
    lastError = msg;
    isConnected = false;
    return false;
  }
}

export async function closeDB(): Promise<void> {
  if (client) {
    try {
      await client.close();
      isConnected = false;
      client = null;
      db = null;
    } catch (e) {
      console.error('[MongoDB] Error closing connection:', e);
    }
  }
}

export function getDbStatus() {
  const uri = process.env.MONGODB_URI;
  const isConfigured = Boolean(uri && !uri.includes('username:password@cluster.mongodb.net'));
  return {
    connected: isConnected,
    isConfigured,
    database: isConnected ? (db?.databaseName || 'studentspend') : 'local_memory_fallback',
    clusterType: uri?.startsWith('mongodb+srv://') ? 'MongoDB Atlas (SRV)' : (uri ? 'Standard URI' : 'None'),
    error: lastError,
  };
}

export async function findUserByIdv(idv: string): Promise<UserDoc | null> {
  if (isConnected && db) {
    const col = db.collection<UserDoc>('users');
    return await col.findOne({ idv });
  }
  return memoryUsers.get(idv) || null;
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  if (isConnected && db) {
    const col = db.collection<UserDoc>('users');
    return await col.findOne({ id });
  }
  for (const u of memoryUsers.values()) {
    if (u.id === id) return u;
  }
  return null;
}

export async function saveUser(user: UserDoc): Promise<void> {
  if (isConnected && db) {
    const col = db.collection<UserDoc>('users');
    await col.updateOne({ id: user.id }, { $set: user }, { upsert: true });
  } else {
    memoryUsers.set(user.idv, user);
  }
}

export async function deleteUser(id: string): Promise<void> {
  if (isConnected && db) {
    const col = db.collection<UserDoc>('users');
    const u = await col.findOne({ id });
    if (u) {
      await col.deleteOne({ id });
      await db.collection<UserDataDoc>('userdata').deleteOne({ userId: id });
    }
  } else {
    for (const [k, v] of memoryUsers.entries()) {
      if (v.id === id) {
        memoryUsers.delete(k);
        memoryData.delete(id);
        break;
      }
    }
  }
}

export async function getUserData(userId: string): Promise<UserDataDoc | null> {
  if (isConnected && db) {
    const col = db.collection<UserDataDoc>('userdata');
    return await col.findOne({ userId });
  }
  return memoryData.get(userId) || null;
}

export async function saveUserData(userId: string, data: Partial<UserDataDoc>): Promise<void> {
  const payload: UserDataDoc = {
    userId,
    tx: data.tx || [],
    cats: data.cats || [],
    budgets: data.budgets || {},
    strict: data.strict || {},
    overall: data.overall || 0,
    hard: Boolean(data.hard),
    ef: data.ef || [],
    efTarget: data.efTarget || 0,
    goals: data.goals || [],
    imports: data.imports || [],
    trash: data.trash || [],
    parents: data.parents || [],
    theme: data.theme || 'light',
    lang: data.lang || 'en',
    custom: data.custom,
    profile: data.profile || {},
    updatedAt: Date.now(),
  };

  if (isConnected && db) {
    const col = db.collection<UserDataDoc>('userdata');
    await col.updateOne({ userId }, { $set: payload }, { upsert: true });
  } else {
    memoryData.set(userId, payload);
  }
}
