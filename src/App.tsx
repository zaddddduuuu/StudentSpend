import { useEffect } from 'react';
import { initStudentSpend } from './studentSpend';

export default function App() {
  useEffect(() => {
    initStudentSpend();
  }, []);

  return (
    <>
      <nav aria-label="Main">
        <h1>StudentSpend</h1>
        <div id="who" className="note" style={{ margin: '-8px 8px 14px' }}></div>
        <a href="#dashboard">🏠 Dashboard</a>
        <a href="#transactions">💸 Transactions</a>
        <a href="#budgets">🎯 Budgets</a>
        <a href="#savings">🐷 Savings</a>
        <a href="#emergency">🛡️ Emergency Fund</a>
        <a href="#insights">✨ Insights &amp; AI</a>
        <a href="#categories">🏷️ Categories</a>
        <a href="#share">🔗 Share</a>
        <a href="#statement">🧾 Statement</a>
        <a href="#trash">🗑️ Recently deleted</a>
        <a href="#settings">⚙️ Settings</a>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            (window as any).signOut?.();
          }}
        >
          🚪 Sign out
        </a>
      </nav>
      <div id="tb">
        <button
          className="av"
          id="av"
          onClick={() => (window as any).showProfile?.()}
          aria-label="View profile"
        >
          S
        </button>
      </div>
      <main id="m"></main>
    </>
  );
}
