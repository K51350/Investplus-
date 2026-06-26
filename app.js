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

// SYSTEME DE NOTIFICATION TOAST
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4000);
}

// TOGGLE THEME LUMINEUX / SOMBRE
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

// FETCH DE L'HISTORIQUE DE TRANSACTIONS
async function fetchUserLiveHistory(uid) {
    const historyBody = document.getElementById('user-tx-history');
    if (!historyBody) return;
    try {
        let allTransactions = [];

        // Retraits
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

        // Dépôts soumis
        const qDeposits = query(collection(db, "deposits"), where("userId", "==", uid));
        const snapDeposits = await getDocs(qDeposits);
        snapDeposits.forEach(doc => {
            const d = doc.data();
            allTransactions.push({
                date: d.createdAt ? d.createdAt.toDate() : new Date(),
                label: `📥 Demande Dépôt (${d.status || 'En attente'})`,
                amount: `+${d.amount} FCFA`,
                color: d.status === 'Validé' ? '#00e676' : '#1cd0f9'
            });
        });

        // Achats robots
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

        allTransactions.sort((a, b) => b.date - a.date);

        if (allTransactions.length === 0) {
            historyBody.innerHTML = `<tr><td colspan="3" style="color:var(--text-muted); text-align:center;">Aucune transaction.</td></tr>`;
            return;
        }

        historyBody.innerHTML = allTransactions.map(tx => `
            <tr>
                <td style="color:var(--text-muted); font-size:0.85rem;">${tx.date.toLocaleString('fr-FR')}</td>
                <td>${tx.label}</td>
                <td style="font-weight:bold; color:${tx.color};">${tx.amount}</td>
            </tr>
        `).join('');
    } catch (e) {
        historyBody.innerHTML = `<tr><td colspan="3" style="color:#ff3b30; text-align:center;">Erreur historique.</td></tr>`;
    }
}

// MISE A JOUR DE L'INTERFACE UTILISATEUR
async function updateUI(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) {
            const userData = docSnap.data();
            globalTransactionCodePin = userData.transactionPin || "1234";

            if(document.getElementById('user-balance')) document.getElementById('user-balance').innerText = `${userData.balance || 0} FCFA`;
            if(document.getElementById('profile-display-balance')) document.getElementById('profile-display-balance').innerText = `${userData.balance || 0} FCFA`;
            if(document.getElementById('active-packs')) document.getElementById('active-packs').innerText = userData.activePacksCount || 0;
            if(document.getElementById('daily-profit')) document.getElementById('daily-profit').innerText = `${userData.dailyProfit || 0} FCFA`;
            if(document.getElementById('profile-display-name')) document.getElementById('profile-display-name').innerText = userData.username || "Membre";
            if(document.getElementById('profile-display-id')) document.getElementById('profile-display-id').innerText = `ID: ${uid}`;
            
            await fetchUserLiveHistory(uid);
        }
    } catch (err) { console.error("Erreur UI:", err); }
}

// OBSÉRVATEUR DE CONNEXION (AUTH CHANGED)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        if (window.location.pathname.includes("dashboard.html")) {
            await updateUI(user.uid);
            showToast("👋 Session sécurisée active !");
        }
    } else if (window.location.pathname.includes("dashboard.html")) {
        window.location.href = "index.html";
    }
});

// LOGIQUE INTERACTIVE DU DASHBOARD
if (window.location.pathname.includes("dashboard.html")) {

    // Déconnexion
    if(document.getElementById('btn-logout')) {
        document.getElementById('btn-logout').addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = "index.html";
        });
    }

    // Gestion de l'affichage des fenêtres modales
    const setupModal = (btnId, modalId, closeId) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        const close = document.getElementById(closeId);
        if(btn && modal && close) {
            btn.addEventListener('click', () => modal.style.display = 'flex');
            close.addEventListener('click', () => modal.style.display = 'none');
        }
    };
    setupModal('open-deposit', 'modal-deposit', 'close-deposit');
    setupModal('open-withdraw', 'modal-withdraw', 'close-withdraw');
    setupModal('open-transfer', 'modal-transfer', 'close-transfer');

    // MODIFICATION DE PROFIL (NOM D'UTILISATEUR)
    if(document.getElementById('btn-edit-profile')) {
        document.getElementById('btn-edit-profile').addEventListener('click', async () => {
            const newName = prompt("Entrez votre nouveau nom d'utilisateur :");
            if (newName && newName.trim() !== "") {
                try {
                    await updateDoc(doc(db, "users", currentUserUid), { username: newName.trim() });
                    showToast("👤 Nom de profil modifié !");
                    await updateUI(currentUserUid);
                } catch (error) { alert("Erreur modification : " + error.message); }
            }
        });
    }

    // ENVOI D'UNE DEMANDE DE DÉPÔT
    if(document.getElementById('submit-deposit')) {
        document.getElementById('submit-deposit').addEventListener('click', async () => {
            const amountInput = document.getElementById('deposit-amount');
            const refInput = document.getElementById('deposit-reference');
            const amount = parseInt(amountInput.value);
            const ref = refInput.value.trim();

            if(!amount || amount <= 0 || !ref) { alert("Veuillez remplir correctement tous les champs."); return; }

            try {
                await addDoc(collection(db, "deposits"), {
                    userId: currentUserUid,
                    amount: amount,
                    reference: ref,
                    status: "En attente",
                    createdAt: new Date()
                });
                document.getElementById('modal-deposit').style.display = 'none';
                amountInput.value = ""; refInput.value = "";
                showToast("📥 Demande de dépôt reçue ! En attente de validation admin.");
                await updateUI(currentUserUid);
            } catch (error) { alert("Erreur de dépôt : " + error.message); }
        });
    }

    // ACCIONNER UN RETRAIT
    if(document.getElementById('submit-withdraw')) {
        document.getElementById('submit-withdraw').addEventListener('click', async () => {
            const amount = parseInt(document.getElementById('withdraw-amount').value);
            const recipient = document.getElementById('withdraw-recipient').value.trim();
            const pin = document.getElementById('withdraw-pin').value.trim();

            if(amount < 2050) { alert("Le retrait minimum est de 2050 FCFA."); return; }
            if(pin !== globalTransactionCodePin) { alert("🔒 Code PIN de transaction incorrect !"); return; }

            try {
                const userSnap = await getDoc(doc(db, "users", currentUserUid));
                const currentBalance = userSnap.data().balance || 0;
                if(currentBalance < amount) { alert("Solde insuffisant."); return; }

                // Déduction immédiate du solde et enregistrement de la demande
                await updateDoc(doc(db, "users", currentUserUid), { balance: currentBalance - amount });
                await addDoc(collection(db, "withdrawals"), {
                    userId: currentUserUid,
                    amount: amount,
                    destination: recipient,
                    status: "En attente",
                    createdAt: new Date()
                });

                document.getElementById('modal-withdraw').style.display = 'none';
                showToast("💸 Demande de retrait envoyée à l'administration.");
                await updateUI(currentUserUid);
            } catch (error) { alert("Erreur base de données : " + error.message); }
        });
    }

    // ACHAT DE PACKS ROBOTS
    async function buyPack(packName, price, dailyIncome) {
        try {
            const userRef = doc(db, "users", currentUserUid);
            const userSnap = await getDoc(userRef);
            const currentBalance = userSnap.data().balance || 0;

            if (currentBalance < price) { alert("Solde insuffisant pour activer ce robot."); return; }

            await updateDoc(userRef, {
                balance: currentBalance - price,
                activePacksCount: (userSnap.data().activePacksCount || 0) + 1,
                dailyProfit: (userSnap.data().dailyProfit || 0) + dailyIncome
            });

            await addDoc(collection(db, "purchases"), {
                userId: currentUserUid,
                packName: packName,
                price: price,
                purchasedAt: new Date()
            });

            showToast(`🤖 Robot ${packName} configuré et activé !`);
            await updateUI(currentUserUid);
        } catch (error) { alert("Erreur d'achat : " + error.message); }
    }

    if(document.getElementById('buy-viper')) document.getElementById('buy-viper').addEventListener('click', () => buyPack('Viper', 2000, 100));
    if(document.getElementById('buy-extincteur')) document.getElementById('buy-extincteur').addEventListener('click', () => buyPack('Extincteur', 4000, 220));
}
