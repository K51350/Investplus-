import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuration Firebase : Veillez à insérer vos clés d'API ici
const firebaseConfig = {
    apiKey: "VOTRE_API_KEY",
    authDomain: "VOTRE_AUTH_DOMAIN",
    projectId: "VOTRE_PROJECT_ID",
    storageBucket: "VOTRE_STORAGE_BUCKET",
    messagingSenderId: "VOTRE_MESSAGING_SENDER_ID",
    appId: "VOTRE_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserUid = null;

// =========================================================================
// MISE À JOUR DES DONNÉES EN TEMPS RÉEL (SANS CASSER LE DESIGN)
// =========================================================================
function setupDashboardRealtimeSync(uid) {
    const userRef = doc(db, "users", uid);

    onSnapshot(userRef, (userDoc) => {
        if (userDoc.exists()) {
            const data = userDoc.data();

            // 1. STATISTIQUES EN HAUT DE PAGE
            const balanceEl = document.getElementById('user-balance');
            if (balanceEl) balanceEl.innerText = `${data.balance || 0} FCFA`;

            const packsEl = document.getElementById('active-packs');
            if (packsEl) packsEl.innerText = data.activePacksCount || 0;

            const profitEl = document.getElementById('daily-profit');
            if (profitEl) profitEl.innerText = `${data.dailyProfit || 0} FCFA`;

            // 2. TEXTE ET AVATAR DE LA SIDEBAR (Préserve les émojis ✏️ et 📷)
            const nameEl = document.getElementById('profile-display-name');
            if (nameEl) nameEl.innerText = data.username || "KAZOS 🇧🇫";

            const idEl = document.getElementById('profile-display-id');
            if (idEl) idEl.innerText = uid;

            const avatarImg = document.getElementById('user-profile-img');
            if (avatarImg && data.avatarUrl && data.avatarUrl.trim() !== "") {
                avatarImg.src = data.avatarUrl; // Ne change que l'image, pas le bouton de l'appareil photo
            }

            // 3. LIEN D'AFFILIATION DYNAMIQUE
            const refLink = document.getElementById('referral-link');
            if (refLink) {
                const currentHost = window.location.origin;
                refLink.value = `${currentHost}/?ref=${uid}`;
            }
        }
    });
}

// =========================================================================
// ÉVÉNEMENTS DE L'INTERFACE UTILISATEUR
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    
    // GESTION DU MENU LATÉRAL (Ouverture / Fermeture)
    const sidebar = document.getElementById('sidebarMenu');
    document.getElementById('menu-open')?.addEventListener('click', () => sidebar.classList.add('open'));
    document.getElementById('menu-close')?.addEventListener('click', () => sidebar.classList.remove('open'));

    // COPIER LE LIEN D'AFFILIATION
    const btnCopy = document.getElementById('btn-copy-link');
    const refInput = document.getElementById('referral-link');
    if (btnCopy && refInput) {
        btnCopy.addEventListener('click', () => {
            refInput.select();
            navigator.clipboard.writeText(refInput.value);
            showToast("Lien de parrainage copié !");
        });
    }

    // MISE À JOUR DE LA PHOTO DE PROFIL
    const avatarInput = document.getElementById('avatar-input-file');
    if (avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    if (currentUserUid) {
                        try {
                            await updateDoc(doc(db, "users", currentUserUid), { avatarUrl: event.target.result });
                            showToast("Photo mise à jour !");
                        } catch (err) {
                            showToast("Erreur lors de l'enregistrement.");
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // DÉCONNEXION
    document.getElementById('btn-logout')?.addEventListener('click', () => {
        signOut(auth).then(() => window.location.href = "index.html");
    });
});

// NOTIFICATIONS TOAST
function showToast(message) {
    const container = document.getElementById('toast-container');
    if (container) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// VÉRIFICATION DE LA SESSION UTILISATEUR
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserUid = user.uid;
        setupDashboardRealtimeSync(user.uid);
    } else {
        window.location.href = "index.html"; // Redirection si non connecté
    }
});
