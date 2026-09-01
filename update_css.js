const fs = require('fs');

const premiumCSS = `
    /* ============================================================
       DESIGN SYSTEM MINEX — CMOC PREMIUM CORPORATE
    ============================================================ */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    :root {
        /* CMOC Purple Palette */
        --c-purple-900: #29105C;
        --c-purple-800: #331274;
        --c-purple-700: #4F16A8;
        --c-purple-600: #6D28D9;
        --c-purple-500: #8B5CF6;
        --c-purple-400: #A78BFA;
        --c-purple-glow: rgba(109, 40, 217, 0.4);

        /* Semantic Colors */
        --c-success: #22C55E;
        --c-success-bg: rgba(34, 197, 94, 0.15);
        --c-warning: #F59E0B;
        --c-warning-bg: rgba(245, 158, 11, 0.15);
        --c-danger: #EF4444;
        --c-danger-bg: rgba(239, 68, 68, 0.15);
        --c-info: #3B82F6;

        /* Typography */
        --font-main: 'Inter', sans-serif;
        --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

        /* Transitions */
        --t-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
        --t-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
        --t-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);

        /* Radii */
        --r-sm: 8px;
        --r-md: 12px;
        --r-lg: 16px;
        --r-full: 9999px;
    }

    [data-theme="dark"], :root {
        --bg-root: #09070F;
        --bg-surface: #0F0C17;
        --bg-card: #14111D;
        --bg-card-elevated: #191522;
        --bg-hover: #201A2C;
        
        --border-color: #282132;
        --border-light: rgba(255,255,255,0.04);
        
        --text-main: #F5F3FA;
        --text-sec: #A9A3B5;
        --text-mut: #6F687A;

        --shadow-card: 0 10px 30px rgba(0,0,0,0.20);
        --shadow-glow: 0 0 20px rgba(79, 22, 168, 0.15);
    }

    [data-theme="light"] {
        --bg-root: #F7F7FA;
        --bg-surface: #FFFFFF;
        --bg-card: #FFFFFF;
        --bg-card-elevated: #FFFFFF;
        --bg-hover: #F0EEF5;
        
        --border-color: #E7E3ED;
        --border-light: rgba(0,0,0,0.04);
        
        --text-main: #16131C;
        --text-sec: #6F687A;
        --text-mut: #9B95A6;

        --shadow-card: 0 8px 25px rgba(20,10,40,0.08);
        --shadow-glow: 0 4px 15px rgba(79, 22, 168, 0.1);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
        font-family: var(--font-main);
        background: var(--bg-root);
        color: var(--text-main);
        display: flex;
        height: 100vh;
        overflow: hidden;
        transition: background var(--t-base), color var(--t-base);
        /* Premium radial glow for dark mode */
        background-image: radial-gradient(circle at top left, rgba(79, 22, 168, 0.05) 0%, transparent 40%);
    }

    /* =================== COMPONENT: SIDEBAR =================== */
    #sidebar {
        width: 260px;
        background: var(--bg-root);
        border-right: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        transition: width var(--t-base);
        z-index: 50;
    }

    .sidebar-logo {
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 24px;
        flex-direction: column;
        border-bottom: 1px solid var(--border-light);
    }
    
    .sidebar-logo img {
        height: 24px;
        margin-bottom: 4px;
    }
    .sidebar-subtitle {
        font-size: 10px;
        color: var(--text-mut);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
    }

    .sidebar-nav {
        flex: 1;
        padding: 24px 12px;
        overflow-y: auto;
    }

    .nav-section-label {
        font-size: 11px;
        color: var(--text-sec);
        text-transform: uppercase;
        font-weight: 700;
        margin: 16px 0 8px 12px;
        letter-spacing: 0.5px;
    }

    .nav-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: transparent;
        border: none;
        color: var(--text-sec);
        font-size: 14px;
        font-weight: 500;
        border-radius: var(--r-md);
        cursor: pointer;
        transition: all var(--t-fast);
        margin-bottom: 4px;
        position: relative;
    }

    .nav-item:hover {
        background: var(--bg-hover);
        color: var(--text-main);
    }

    .nav-item.active {
        color: var(--text-main);
        background: linear-gradient(90deg, rgba(109, 40, 217, 0.28) 0%, rgba(109, 40, 217, 0.04) 100%);
    }

    .nav-item.active::before {
        content: '';
        position: absolute;
        left: 0;
        top: 10%;
        height: 80%;
        width: 3px;
        background: var(--c-purple-600);
        border-radius: 0 4px 4px 0;
    }
    
    .nav-item.active i { color: var(--c-purple-400); }

    /* =================== COMPONENT: USER PROFILE =================== */
    .sidebar-profile {
        padding: 16px;
        border-top: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: background var(--t-fast);
    }
    .sidebar-profile:hover { background: var(--bg-hover); }
    .profile-avatar {
        width: 36px; height: 36px;
        background: var(--c-purple-700);
        color: #FFF;
        border-radius: var(--r-full);
        display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 14px;
    }
    .profile-info { display: flex; flex-direction: column; }
    .profile-name { font-size: 13px; font-weight: 600; color: var(--text-main); }
    .profile-role { font-size: 11px; color: var(--text-sec); }

    /* =================== MAIN WRAPPER =================== */
    .main-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--bg-surface);
        position: relative;
        overflow: hidden;
    }

    /* =================== COMPONENT: TOPBAR =================== */
    #topbar {
        height: 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 32px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-surface);
        z-index: 40;
    }
    .topbar-left h1 {
        font-size: 20px;
        font-weight: 700;
        color: var(--text-main);
        margin-bottom: 2px;
    }
    .topbar-left p {
        font-size: 13px;
        color: var(--text-sec);
    }
    
    .topbar-right {
        display: flex;
        align-items: center;
        gap: 24px;
    }

    /* Indicator Online */
    .status-indicator {
        display: flex; align-items: center; gap: 8px;
        font-size: 12px; font-weight: 600; color: var(--c-success);
        padding: 6px 12px; border-radius: var(--r-full);
        background: var(--c-success-bg);
    }
    .status-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: var(--c-success);
        animation: pulse-dot 2s infinite cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes pulse-dot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
    }

    .topbar-clock {
        font-family: var(--font-mono);
        font-size: 14px;
        font-weight: 600;
        color: var(--text-main);
        letter-spacing: 1px;
    }

    .theme-toggle {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        color: var(--text-main);
        width: 36px; height: 36px;
        border-radius: var(--r-md);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all var(--t-fast);
    }
    .theme-toggle:hover { background: var(--bg-hover); transform: translateY(-1px); }

    /* =================== CONTENT AREA =================== */
    .content-area {
        flex: 1;
        padding: 32px;
        overflow-y: auto;
    }
    .page-section { display: none; animation: fade-in var(--t-base); }
    .page-section.active { display: block; }

    @keyframes fade-in {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* =================== COMPONENT: KPI CARDS =================== */
    .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 20px;
        margin-bottom: 32px;
    }
    .kpi-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--r-lg);
        padding: 24px;
        box-shadow: var(--shadow-card);
        transition: all var(--t-base);
        position: relative;
        overflow: hidden;
    }
    .kpi-card:hover {
        transform: translateY(-2px);
        border-color: var(--c-purple-600);
        box-shadow: var(--shadow-glow);
    }
    .kpi-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .kpi-icon {
        width: 40px; height: 40px;
        background: var(--bg-surface);
        border-radius: var(--r-md);
        display: flex; align-items: center; justify-content: center;
        color: var(--c-purple-500);
    }
    .kpi-title { font-size: 13px; font-weight: 600; color: var(--text-sec); text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-value { font-size: 32px; font-weight: 700; color: var(--text-main); margin-bottom: 4px; }
    .kpi-desc { font-size: 12px; color: var(--text-mut); display: flex; align-items: center; gap: 4px; }

    /* =================== COMPONENT: DATA TABLES =================== */
    .table-wrapper {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--r-lg);
        overflow: hidden;
        box-shadow: var(--shadow-card);
    }
    .table-header {
        padding: 20px 24px;
        border-bottom: 1px solid var(--border-color);
        display: flex; justify-content: space-between; align-items: center;
    }
    .table-title { font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th {
        padding: 16px 24px;
        font-size: 12px; font-weight: 600; color: var(--text-sec);
        text-transform: uppercase; letter-spacing: 0.5px;
        background: var(--bg-surface);
        border-bottom: 1px solid var(--border-color);
    }
    td {
        padding: 16px 24px;
        font-size: 14px; color: var(--text-main);
        border-bottom: 1px solid var(--border-light);
        vertical-align: middle;
    }
    tbody tr { transition: background var(--t-fast); }
    tbody tr:hover { background: var(--bg-hover); }

    /* =================== COMPONENT: BADGES =================== */
    .badge {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 10px; border-radius: var(--r-full);
        font-size: 11px; font-weight: 600; letter-spacing: 0.5px;
        text-transform: uppercase;
    }
    .badge-success { background: var(--c-success-bg); color: var(--c-success); }
    .badge-warning { background: var(--c-warning-bg); color: var(--c-warning); }
    .badge-danger { background: var(--c-danger-bg); color: var(--c-danger); }
    .badge-purple { background: rgba(109, 40, 217, 0.15); color: var(--c-purple-400); }
    .badge-gray { background: var(--bg-surface); color: var(--text-sec); border: 1px solid var(--border-color); }

    /* =================== COMPONENT: BUTTONS =================== */
    .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        padding: 10px 18px; border-radius: var(--r-md);
        font-size: 13px; font-weight: 600;
        cursor: pointer; transition: all var(--t-fast);
        border: none;
        font-family: var(--font-main);
    }
    .btn-primary { background: var(--c-purple-700); color: #FFF; box-shadow: 0 4px 12px rgba(79, 22, 168, 0.3); }
    .btn-primary:hover { background: var(--c-purple-600); transform: translateY(-1px); }
    .btn-secondary { background: transparent; color: var(--text-main); border: 1px solid var(--border-color); }
    .btn-secondary:hover { background: var(--bg-hover); }

    /* Form Inputs */
    .input-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .input-label { font-size: 12px; font-weight: 600; color: var(--text-sec); }
    .input-field {
        background: var(--bg-surface); border: 1px solid var(--border-color);
        padding: 10px 14px; border-radius: var(--r-md);
        color: var(--text-main); font-size: 14px;
        transition: all var(--t-fast); outline: none;
    }
    .input-field:focus { border-color: var(--c-purple-500); box-shadow: 0 0 0 3px rgba(109, 40, 217, 0.15); }
    
    /* Utility */
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-hover); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--text-sec); border: 1px solid var(--border-color); }
    .flex-row { display: flex; align-items: center; gap: 12px; }
`;

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<style>[\s\S]*?<\/style>/, "<style>\n" + premiumCSS + "\n</style>");
fs.writeFileSync('index.html', html);
console.log("CSS Premium aplicado com sucesso!");
