import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDmwolOcWtfesehxqyxxk7-erLuUZ6OQYw",
    authDomain: "cashflow-1bcad.firebaseapp.com",
    projectId: "cashflow-1bcad",
    storageBucket: "cashflow-1bcad.firebasestorage.app",
    messagingSenderId: "190480009995",
    appId: "1:190480009995:web:eff1dd2b4703256fdd700e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserUid = null;
let globalTransactionCodePin = "1234";

// SYNCHRONISATION DU PROFILE ET DE L'INTERFACE
async function updateUI(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) {
            const userData = docSnap.data();
            globalTransactionCodePin = userData.transactionPin || "1234";

            if(document.getElementById('user-balance')) document.getElementById('user-balance').innerText = `${userData.balance || 0} FCFA`;
            if(document.getElementById('daily-profit')) document.getElementById('daily-profit').innerText = `${userData.dailyProfit || 0} FCFA`;
            if(document.getElementById('active-packs')) document.getElementById('active-packs').innerText = userData.activePacksCount || 0;
            if(document.getElementById('profile-display-name')) document.getElementById('profile-display-name').innerText = userData.username || "Utilisateur";
            if(document.getElementById('profile-display-id')) document.getElementById('profile-display-id').innerText = `ID: ${uid}`;
            
            // Calcul et affichage du lien de parrainage réintégré
            if(document.getElementById('referral-link')) {
                document.getElementById('referral-link').value = `${window.location.origin}/index.html?ref=${uid}`;
            }
        }
    } catch (err) { console.error("Erreur UI sync :", err); }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        await updateUI(user.uid);
    } else if (window.location.pathname.includes("dashboard.html")) {
        window.location.href = "index.html";
    }
});

// LOGIQUE DES MENUS ET MODALES
document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById('sidebarMenu');
    
    if(document.getElementById('menu-open')) document.getElementById('menu-open').addEventListener('click', () => sidebar.classList.add('open'));
    if(document.getElementById('menu-close')) document.getElementById('menu-close').addEventListener('click', () => sidebar.classList.remove('open'));

    const bindModal = (triggerId, modalId, closeId) => {
        const trig = document.getElementById(triggerId);
        const mod = document.getElementById(modalId);
        const cls = document.getElementById(closeId);
        if(trig && mod && cls) {
            trig.addEventListener('click', () => { mod.style.display = 'flex'; sidebar.classList.remove('open'); });
            cls.addEventListener('click', () => mod.style.display = 'none');
        }
    };
    
    bindModal('menu-open-deposit', 'modal-deposit', 'close-deposit');
    bindModal('menu-open-withdraw', 'modal-withdraw', 'close-withdraw');

    // MODIFIER LE NOM DE PROFIL
    if(document.getElementById('btn-edit-profile')) {
        document.getElementById('btn-edit-profile').addEventListener('click', async () => {
            const newName = prompt("Entrez votre nouveau nom d'utilisateur :");
            if (newName && newName.trim() !== "") {
                await updateDoc(doc(db, "users", currentUserUid), { username: newName.trim() });
                await updateUI(currentUserUid);
            }
        });
    }

    // ACHAT DE ROBOT (VIPER, EXTINCTEUR, CYCLONE)
    async function processPackPurchase(packName, cost, dailyRevenue) {
        const userRef = doc(db, "users", currentUserUid);
        const snap = await getDoc(userRef);
        const currentBalance = snap.data().balance || 0;

        if (currentBalance < cost) { alert("Solde insuffisant."); return; }

        await updateDoc(userRef, {
            balance: currentBalance - cost,
            activePacksCount: (snap.data().activePacksCount || 0) + 1,
            dailyProfit: (snap.data().dailyProfit || 0) + dailyRevenue
        });

        await addDoc(collection(db, "purchases"), {
            userId: currentUserUid, packName: packName, price: cost, purchasedAt: new Date()
        });

        alert(`Robot ${packName} activé !`);
        await updateUI(currentUserUid);
    }

    if(document.getElementById('buy-viper')) document.getElementById('buy-viper').addEventListener('click', () => processPackPurchase('Viper', 2000, 100));
    if(document.getElementById('buy-extincteur')) document.getElementById('buy-extincteur').addEventListener('click', () => processPackPurchase('Extincteur', 4000, 220));
    if(document.getElementById('buy-cyclone')) document.getElementById('buy-cyclone').addEventListener('click', () => processPackPurchase('Cyclone', 10000, 600));

    // LOGIQUE DE DECONNEXION
    const logoutAction = async () => { await signOut(auth); window.location.href = "index.html"; };
    if(document.getElementById('btn-logout-sidebar')) document.getElementById('btn-logout-sidebar').addEventListener('click', logoutAction);
});
   
