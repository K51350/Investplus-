import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDmwolOcWtfesehxqyxxk7-erLuUZ6OQYw",
    authDomain: "cashflow-1bcad.firebaseapp.com",
    projectId: "cashflow-1bcad",
    storageBucket: "cashflow-1bcad.firebasestorage.app",
    messagingSenderId: "190480009995",
    appId: "1:190480009995:web:eff1dd2b4703256fdd700e",
    measurementId: "G-GC02GQR1F1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserUid = null;
let globalTransactionCodePin = "1234";

// TOAST NOTIFICATIONS SYSTEMS
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

// MANAGEMENT DU THEME (LIGHT / DARK)
if (document.getElementById('theme-toggle')) {
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// RECUPERATION EN LIVE ET TRIÉ DE L'HISTORIQUE
async function fetchUserLiveHistory(uid) {
    const historyBody = document.getElementById('user-tx-history');
    if (!historyBody) return;
    try {
        let allTransactions = [];

        const qWithdrawals = query(collection(db, "withdrawals"), where("userId", "==", uid));
        const snapWithdrawals = await getDocs(qWithdrawals);
        snapWithdrawals.forEach(doc => {
            const d = doc.data();
            allTransactions.push({
                date: d.createdAt ? d.createdAt.toDate() : new Date(),
                label: `💸 Retrait Sortant (${d.status || 'En attente'})`,
                amount: `-${d.amount} FCFA`,
                color: d.status === 'Rejeté' ? '#ff3b30' : '#ffaa00'
            });
        });

        const qPurchases = query(collection(db, "purchases"), where("userId", "==", uid));
        const snapPurchases = await getDocs(qPurchases);
        snapPurchases.forEach(doc => {
            const d = doc.data();
            allTransactions.push({
                date: d.purchasedAt ? d.purchasedAt.toDate() : new Date(),
                label: `🤖 Activation Robot ${d.packName}`,
                amount: `-${d.price} FCFA`,
                color: '#9b51e0'
            });
        });

        const qTransfersSent = query(collection(db, "transfers"), where("senderId", "==", uid));
        const snapTransfersSent = await getDocs(qTransfersSent);
        snapTransfersSent.forEach(doc => {
            const d = doc.data();
            allTransactions.push({
                date: d.createdAt ? d.createdAt.toDate() : new Date(),
                label: `🔄 Transfert envoyé (ID: ..${String(d.receiverId).slice(-4)})`,
                amount: `-${d.amount} FCFA`,
                color: '#1cd0f9'
            });
        });

        const qTransfersReceived = query(collection(db, "transfers"), where("receiverId", "==", uid));
        const snapTransfersReceived = await getDocs(qTransfersReceived);
        snapTransfersReceived.forEach(doc => {
            const d = doc.data();
            allTransactions.push({
                date: d.createdAt ? d.createdAt.toDate() : new Date(),
                label: `📩 Transfert reçu d'un membre`,
                amount: `+${d.amount} FCFA`,
                color: '#00e676'
            });
        });

        allTransactions.sort((a, b) => b.date - a.date);

        if (allTransactions.length === 0) {
            historyBody.innerHTML = `<tr><td colspan="3" style="color:var(--text-muted); text-align:center;">Aucun historique trouvé.</td></tr>`;
            return;
        }

        historyBody.innerHTML = allTransactions.map(tx => `
            <tr>
                <td style="color:var(--text-muted); font-family:monospace;">${tx.date.toLocaleString('fr-FR')}</td>
                <td>${tx.label}</td>
                <td style="font-weight:bold; color:${tx.color};">${tx.amount}</td>
            </tr>
        `).join('');
    } catch (e) {
        historyBody.innerHTML = `<tr><td colspan="3" style="color:#ff3b30; text-align:center;">Erreur de chargement.</td></tr>`;
    }
}

// LOGIQUE DE CONNEXION (SIGN-IN)
const formLogin = document.getElementById('form-login');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "dashboard.html";
        } catch (error) {
            alert("Erreur de connexion : " + error.message);
        }
    });
}

// INSCRIPTION
const formRegister = document.getElementById('form-register');
if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pinCode = prompt("Définissez votre Code PIN de transaction secret (4 chiffres) :");
        if(!pinCode || pinCode.length !== 4 || isNaN(pinCode)) {
            alert("Le code PIN doit être composé de exactement 4 chiffres numériques.");
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, document.getElementById('reg-email').value, document.getElementById('reg-password').value);
            await setDoc(doc(db, "users", userCredential.user.uid), {
                username: document.getElementById('reg-username').value,
                email: document.getElementById('reg-email').value,
                balance: 0, activePacksCount: 0, dailyProfit: 0, profilePic: "",
                transactionPin: pinCode,
                referredBy: new URLSearchParams(window.location.search).get('ref') || null,
                createdAt: new Date()
            });
            window.location.href = "dashboard.html";
        } catch (error) { alert("Erreur: " + error.message); }
    });
}

// SINCRONISATION DES DONNÉES UTILISATEUR ET UI
async function updateUI(uid) {
    const docSnap = await getDoc(doc(db, "users", uid));
    if (docSnap.exists()) {
        const userData = docSnap.data();
        globalTransactionCodePin = userData.transactionPin || "1234";

        if(document.getElementById('user-balance')) document.getElementById('user-balance').innerText = `${userData.balance} FCFA`;
        if(document.getElementById('profile-display-balance')) document.getElementById('profile-display-balance').innerText = `${userData.balance} FCFA`;
        if(document.getElementById('active-packs')) document.getElementById('active-packs').innerText = userData.activePacksCount;
        if(document.getElementById('daily-profit')) document.getElementById('daily-profit').innerText = `${userData.dailyProfit} FCFA`;
        if(document.getElementById('profile-display-name')) document.getElementById('profile-display-name').innerText = userData.username;
        if(document.getElementById('profile-display-id')) document.getElementById('profile-display-id').innerText = uid;
        
        if(document.getElementById('referral-link')) {
            document.getElementById('referral-link').value = `${window.location.origin}${window.location.pathname.replace('dashboard.html', 'index.html')}?ref=${uid}`;
        }
        await fetchUserLiveHistory(uid);
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        if (window.location.pathname.includes("dashboard.html")) {
            await updateUI(user.uid);
            showToast("👋 Bienvenue sur votre session sécurisée !");
        }
    } else if (window.location.pathname.includes("dashboard.html")) {
        window.location.href = "index.html";
    }
});

// ACTIONS DU TABLEAU DE BORD
if (window.location.pathname.includes("dashboard.html")) {
    const sidebar = document.getElementById('sidebarMenu');
    if(document.getElementById('menu-open')) document.getElementById('menu-open').addEventListener('click', () => sidebar.classList.add('open'));
    if(document.getElementById('menu-close')) document.getElementById('menu-close').addEventListener('click', () => sidebar.classList.remove('open'));

    if(document.getElementById('btn-logout')) {
        document.getElementById('btn-logout').addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = "index.html";
        });
    }

    const setupModal = (btnId, modalId, closeId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        const close = document.getElementById(closeId);
        if(btn && modal && close) {
            btn.addEventListener('click', () => { modal.style.display = 'flex'; sidebar.classList.remove('open'); });
            close.addEventListener('click', () => modal.style.display = 'none');
        }
    };
    setupModal('open-deposit', 'modal-deposit', 'close-deposit');
    setupModal('open-withdraw', 'modal-withdraw', 'close-withdraw');
    setupModal('open-transfer', 'modal-transfer', 'close-transfer');

    // LOGIQUE DE MODIFICATION DU NOM DE PROFIL
    if(document.getElementById('btn-edit-profile')) {
        document.getElementById('btn-edit-profile').addEventListener('click', async () => {
            const newName = prompt("Entrez votre nouveau nom d'utilisateur :");
            if (newName && newName.trim() !== "") {
                try {
                    await updateDoc(doc(db, "users", currentUserUid), { username: newName.trim() });
                    showToast("👤 Nom d'utilisateur mis à jour !");
                    await updateUI(currentUserUid);
                } catch (error) {
                    alert("Erreur lors de la modification : " + error.message);
                }
            }
        });
    }

    // SECURISATION DU RETRAIT
    if(document.getElementById('submit-withdraw')) {
        document.getElementById('submit-withdraw').addEventListener('click', async () => {
            const amount = parseInt(document.getElementById('withdraw-amount').value);
            const recipient = document.getElementById('withdraw-recipient').value.trim();
            const pin = document.getElementById('withdraw-pin').value.trim();

            if(amount < 2050) { alert("Le retrait minimum est de 2050 FCFA."); return; }
            if(pin !== globalTransactionCodePin) { alert("🔒 Code PIN incorrect !"); return; }

            try {
                const userSnap = await getDoc(doc(db, "users", currentUserUid));
                if((userSnap.data().balance || 0) < amount) { alert("Solde insuffisant."); return; }

                await updateDoc(doc(db, "users", currentUserUid), { balance: userSnap.data().balance - amount });
                await addDoc(collection(db, "withdrawals"), { userId: currentUserUid, amount: amount, destination: recipient, status: "En attente", createdAt: new Date() });

                document.getElementById('modal-withdraw').style.display = 'none';
                showToast("💸 Demande de retrait enregistrée.");
                await updateUI(currentUserUid);
            } catch (error) {
                alert("Erreur base de données : " + error.message);
            }
        });
    }
}
