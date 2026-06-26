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
// Init theme de manière persistante
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// RECUPERATION EN LIVE ET TRIÉ DE L'HISTORIQUE DE L'UTILISATEUR CONNECTÉ
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

// INCRIPTION & INITIALISATION DU CODE PIN SECURISÉ
const formRegister = document.getElementById('form-register');
if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pinCode = prompt("Définissez votre Code PIN de transaction secret (4 chiffres) :");
        if(!pinCode || pinCode.length !== 4 || isNaN(pinCode)) {
            alert("Le code PIN doit être composé de exactement 4 chiffres numérique.");
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

// GESTION DU RÉSEAU ET RECHERCHE PARRAINAGE MULTI-NIVEAUX (8% / 2%)
async function fetchNetworkStats(uid) {
    try {
        let countL1 = 0; let countL2 = 0; let totalComm = 0;
        const qL1 = query(collection(db, "users"), where("referredBy", "==", uid));
        const snapL1 = await getDocs(qL1);
        
        for (const docL1 of snapL1.docs) {
            countL1++;
            const qL2 = query(collection(db, "users"), where("referredBy", "==", docL1.id));
            const snapL2 = await getDocs(qL2);
            countL2 += snapL2.size;
        }

        const qComm = query(collection(db, "commissions"), where("referrerId", "==", uid));
        const snapComm = await getDocs(qComm);
        snapComm.forEach(d => totalComm += d.data().amount);

        if(document.getElementById('net-l1')) document.getElementById('net-l1').innerText = countL1;
        if(document.getElementById('net-l2')) document.getElementById('net-l2').innerText = countL2;
        if(document.getElementById('net-comm')) document.getElementById('net-comm').innerText = `${totalComm} FCFA`;
    } catch(err) { console.error(err); }
}

// APPLICATION LOGIQUE COMMISSIONS MULTI-NIVEAUX
async function triggerCommissions(userUid, packPrice) {
    const userSnap = await getDoc(doc(db, "users", userUid));
    if (!userSnap.exists()) return;
    
    const parrainL1 = userSnap.data().referredBy;
    if (parrainL1) {
        // Niveau 1 : 8%
        const snapRef1 = await getDoc(doc(db, "users", parrainL1));
        if (snapRef1.exists()) {
            const bonusL1 = Math.floor(packPrice * 0.08);
            await updateDoc(doc(db, "users", parrainL1), { balance: (snapRef1.data().balance || 0) + bonusL1 });
            await addDoc(collection(db, "commissions"), { referrerId: parrainL1, fromId: userUid, level: 1, amount: bonusL1, date: new Date() });
            
            // Niveau 2 : 2%
            const parrainL2 = snapRef1.data().referredBy;
            if (parrainL2) {
                const snapRef2 = await getDoc(doc(db, "users", parrainL2));
                if (snapRef2.exists()) {
                    const bonusL2 = Math.floor(packPrice * 0.02);
                    await updateDoc(doc(db, "users", parrainL2), { balance: (snapRef2.data().balance || 0) + bonusL2 });
                    await addDoc(collection(db, "commissions"), { referrerId: parrainL2, fromId: userUid, level: 2, amount: bonusL2, date: new Date() });
                }
            }
        }
    }
}

// SINCRONISATION DES DONNÉES UTILISATEUR ET UI
async function updateUI(uid) {
    const docSnap = await getDoc(doc(db, "users", uid));
    if (docSnap.exists()) {
        const userData = docSnap.data();
        globalTransactionCodePin = userData.transactionPin || "1234";

        document.getElementById('user-balance').innerText = `${userData.balance} FCFA`;
        document.getElementById('profile-display-balance').innerText = `${userData.balance} FCFA`;
        document.getElementById('active-packs').innerText = userData.activePacksCount;
        document.getElementById('daily-profit').innerText = `${userData.dailyProfit} FCFA`;
        document.getElementById('profile-display-name').innerText = userData.username;
        document.getElementById('profile-display-id').innerText = uid;
        
        document.getElementById('referral-link').value = `${window.location.origin}${window.location.pathname.replace('dashboard.html', 'index.html')}?ref=${uid}`;
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

// MODALES TRIGGERS & CLOSERS
if (window.location.pathname.includes("dashboard.html")) {
    const sidebar = document.getElementById('sidebarMenu');
    document.getElementById('menu-open').addEventListener('click', () => sidebar.classList.add('open'));
    document.getElementById('menu-close').addEventListener('click', () => sidebar.classList.remove('open'));

    const setupModal = (btnId, modalId, closeId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        const close = document.getElementById(closeId);
        if(btn && modal && close) {
            btn.addEventListener('click', () => { modal.style.display = 'flex'; sidebar.classList.remove('open'); if(btnId==='open-network') fetchNetworkStats(currentUserUid); });
            close.addEventListener('click', () => modal.style.display = 'none');
        }
    };
    setupModal('open-deposit', 'modal-deposit', 'close-deposit');
    setupModal('open-withdraw', 'modal-withdraw', 'close-withdraw');
    setupModal('open-transfer', 'modal-transfer', 'close-transfer');
    setupModal('open-network', 'modal-network', 'close-network');
    setupModal('open-support', 'modal-support', 'close-support');

    // SUBMIT TICKET DE SUPPORT
    document.getElementById('submit-support').addEventListener('click', async () => {
        const msg = document.getElementById('support-msg').value.trim();
        if(!msg) return;
        await addDoc(collection(db, "support_tickets"), { userId: currentUserUid, message: msg, status: "Ouvert", createdAt: new Date() });
        document.getElementById('support-msg').value = "";
        document.getElementById('modal-support').style.display = 'none';
        showToast("🎫 Ticket support envoyé avec succès à l'administration.");
    });

    // RECHERCHE ID DESTINATAIRE EN TEMPS RÉEL (Live Verification)
    document.getElementById('transfer-target-id').addEventListener('input', async (e) => {
        const idToSearch = e.target.value.trim();
        const feedback = document.getElementById('transfer-live-feedback');
        if(idToSearch.length < 10) { feedback.style.display = 'none'; return; }
        feedback.style.display = 'block'; feedback.className = "live-feedback"; feedback.innerText = "🔍 Recherche...";
        
        const snap = await getDoc(doc(db, "users", idToSearch));
        if (snap.exists()) {
            feedback.className = "live-feedback feedback-success";
            feedback.innerText = `✅ Destinataire trouvé : ${snap.data().username}`;
        } else {
            feedback.className = "live-feedback feedback-error";
            feedback.innerText = "❌ Aucun membre avec cet ID.";
        }
    });

    // SECURISATION DU TRANSFERT INTER-COMPTE (MIN 1000 & PIN)
    document.getElementById('submit-transfer').addEventListener('click', async () => {
        const targetId = document.getElementById('transfer-target-id').value.trim();
        const amount = parseInt(document.getElementById('transfer-amount').value);
        const pin = document.getElementById('transfer-pin').value.trim();

        if(amount < 1000) { alert("Le transfert minimum est de 1000 FCFA."); return; }
        if(pin !== globalTransactionCodePin) { alert("🔒 Code PIN incorrect !"); return; }

        const senderSnap = await getDoc(doc(db, "users", currentUserUid));
        if ((senderSnap.data().balance || 0) < amount) { alert("Solde insuffisant."); return; }
        const receiverSnap = await getDoc(doc(db, "users", targetId));
        if (!receiverSnap.exists()) { alert("Destinataire inexistant."); return; }

        await updateDoc(doc(db, "users", currentUserUid), { balance: senderSnap.data().balance - amount });
        await updateDoc(doc(db, "users", targetId), { balance: (receiverSnap.data().balance || 0) + amount });
        await addDoc(collection(db, "transfers"), { senderId: currentUserUid, receiverId: targetId, amount: amount, createdAt: new Date() });

        document.getElementById('modal-transfer').style.display = 'none';
        showToast(`🔄 ${amount} FCFA envoyés avec succès !`);
        await updateUI(currentUserUid);
    });

    // SECURISATION DU RETRAIT (MIN 2050 & PIN & STATUT EN ATTENTE ADMIN)
    document.getElementById('submit-withdraw').addEventListener('click', async () => {
        const amount = parseInt(document.getElementById('withdraw-amount').value);
        const recipient = document.getElementById('withdraw-recipient').value.trim();
        const pin = document.getElementById('withdraw-pin').value.trim();

        if(amount < 2050) { alert("Le retrait minimum est de 2050 FCFA."); return; }
        if(pin !== globalTransactionCodePin) { alert("🔒 Code PIN incorrect !"); return; }

        const userSnap = await getDoc(doc(db, "users", currentUserUid));
        if((userSnap.data().balance || 0) < amount) { alert("Solde insuffisant."); return; }

        await updateDoc(doc(db, "users", currentUserUid), { balance: userSnap.data().balance - amount });
        await addDoc(collection(db, "withdrawals"), { userId: currentUserUid, amount: amount, destination: recipient, status: "En attente", createdAt: new Date() });

        document.getElementById('modal-withdraw').style.display = 'none';
        showToast("💸 Demande de retrait enregistrée et transmise pour audit.");
        await updateUI(currentUserUid);
    });

    // ACHAT PACKS ET DECLENCHEMENT COMMISSIONS MULTI-NIVEAUX
    async function buyPack(packName, price, dailyIncome) {
        const userRef = doc(db, "users", currentUserUid);
        const userSnap = await getDoc(userRef);
        if (userSnap.data().balance < price) { alert("Solde insuffisant."); return; }

        await updateDoc(userRef, {
            balance: userSnap.data().balance - price,
            activePacksCount: userSnap.data().activePacksCount + 1,
            dailyProfit: userSnap.data().dailyProfit + dailyIncome
        });

        await triggerCommissions(currentUserUid, price);
        await addDoc(collection(db, "purchases"), { userId: currentUserUid, packName: packName, price: price, purchasedAt: new Date() });
        showToast(`🤖 Robot ${packName} couplé avec succès !`);
        await updateUI(currentUserUid);
    }

    document.getElementById('buy-viper').addEventListener('click', () => buyPack('Viper', 2000, 100));
    document.getElementById('buy-extincteur').addEventListener('click', () => buyPack('Extincteur', 4000, 220));
    document.getElementById('buy-exterminateur').addEventListener('click', () => buyPack('Exterminateur', 8000, 480));
}
