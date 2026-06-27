import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Configuration Firebase
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
let userTransactionPin = "1234";
let currentSelectedChannel = "";

// FONCTION DE RAFAÎCHISSEMENT DES STATISTIQUES ET DE L'AVATAR
async function refreshDashboardMetrics(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            userTransactionPin = data.transactionPin || "1234";

            // Blocs de suivi financier
            if(document.getElementById('mainBalance')) document.getElementById('mainBalance').innerText = `${data.balance || 0} FCFA`;
            if(document.getElementById('mainActivePacks')) document.getElementById('mainActivePacks').innerText = data.activePacksCount || 0;
            if(document.getElementById('mainDailyProfit')) document.getElementById('mainDailyProfit').innerText = `${data.dailyProfit || 0} FCFA`;

            // Informations textuelles du menu
            if(document.getElementById('sbUsername')) document.getElementById('sbUsername').innerText = data.username || "Utilisateur";
            if(document.getElementById('sbUid')) document.getElementById('sbUid').innerText = `ID : ${uid}`;
            if(document.getElementById('sbBalance')) document.getElementById('sbBalance').innerText = `${data.balance || 0} FCFA`;
            
            // Affichage de la photo de profil (base64 ou URL classique)
            if(document.getElementById('sbAvatar')) {
                if(data.avatarUrl && data.avatarUrl.trim() !== "") {
                    document.getElementById('sbAvatar').innerHTML = `<img src="${data.avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                } else {
                    document.getElementById('sbAvatar').innerHTML = "👤";
                }
            }
            
            if(auth.currentUser && document.getElementById('sbUserEmail')) {
                document.getElementById('sbUserEmail').innerText = auth.currentUser.email;
            }
            
            // CORRECTION : Redirection du lien d'invitation vers le nouvel hébergeur actif
            if(document.getElementById('sbRefLink')) {
                document.getElementById('sbRefLink').value = `https://votre-nouvel-hebergeur.com/?ref=${uid}`;
            }
        }
    } catch (e) { 
        console.error("Erreur de synchronisation des compteurs :", e); 
    }
}

// ÉCOUTE DE SÉCURITÉ DE L'ÉVOLUTION AUTH
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => refreshDashboardMetrics(user.uid));
        } else {
            await refreshDashboardMetrics(user.uid);
        }
    } else {
        window.location.href = "index.html";
    }
});

// INTERACTION DES COMPOSANTS LOGICIELS
document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById('mainSidebar');

    // Panneaux latéraux coulissants
    if(document.getElementById('sidebarOpenBtn')) {
        document.getElementById('sidebarOpenBtn').addEventListener('click', () => sidebar.classList.add('open'));
    }
    if(document.getElementById('sidebarCloseBtn')) {
        document.getElementById('sidebarCloseBtn').addEventListener('click', () => sidebar.classList.remove('open'));
    }

    // Édition textuelle du pseudonyme
    if(document.getElementById('sbUsernameEdit')) {
        document.getElementById('sbUsernameEdit').addEventListener('click', async () => {
            const newName = prompt("Entrez votre nouveau nom d'affichage :");
            if(newName && newName.trim() !== "" && currentUserUid) {
                try {
                    await updateDoc(doc(db, "users", currentUserUid), { username: newName.trim() });
                    await refreshDashboardMetrics(currentUserUid);
                } catch(err) {
                    alert("Erreur lors du changement de nom.");
                }
            }
        });
    }

    // CORRECTION : Gestion de l'ouverture de la galerie pour l'avatar
    const avatarEditBtn = document.getElementById('sbAvatarEdit');
    const avatarFileInput = document.getElementById('avatarFileInput');

    if(avatarEditBtn && avatarFileInput) {
        // Clic sur le bouton de l'appareil photo -> Déclenche le clic sur le sélecteur invisible
        avatarEditBtn.addEventListener('click', () => {
            avatarFileInput.click();
        });

        // Dès que l'utilisateur choisit une photo dans sa galerie locale
        avatarFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                // Vérification sommaire du fichier pour s'assurer qu'il s'agit d'une image
                if (!file.type.startsWith('image/')) {
                    alert("Veuillez sélectionner un fichier image valide.");
                    return;
                }

                const reader = new FileReader();
                // Lecture et conversion du fichier en chaîne de caractères Base64 (DataURL)
                reader.onload = async (e) => {
                    const base64Image = e.target.result;
                    if(currentUserUid) {
                        try {
                            // Enregistrement de la chaîne Base64 directement dans Firestore
                            await updateDoc(doc(db, "users", currentUserUid), { avatarUrl: base64Image });
                            await refreshDashboardMetrics(currentUserUid);
                            alert("Votre photo de profil a été importée et mise à jour !");
                        } catch(err) {
                            console.error(err);
                            alert("Erreur lors de la sauvegarde de l'image.");
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Copie de l'URL de parrainage
    if(document.getElementById('sbCopyRefBtn')) {
        document.getElementById('sbCopyRefBtn').addEventListener('click', () => {
            const copyText = document.getElementById('sbRefLink');
            if(copyText) {
                copyText.select();
                copyText.setSelectionRange(0, 99999);
                navigator.clipboard.writeText(copyText.value);
                alert("Lien de parrainage copié !");
            }
        });
    }

    // Module d'interruption de session
    if(document.getElementById('topLogoutBtn')) {
        document.getElementById('topLogoutBtn').addEventListener('click', async () => {
            try { await signOut(auth); window.location.href = "index.html"; } catch(e) { window.location.href = "index.html"; }
        });
    }

    // Utilitaire d'affichage des fenêtres modales
    const toggleModal = (id, action) => {
        const target = document.getElementById(id);
        if(target) target.style.display = action === 'open' ? 'flex' : 'none';
    };

    // --- CFSG LTD INFORMATION ---
    if(document.getElementById('sbPartnerBtn')) {
        document.getElementById('sbPartnerBtn').addEventListener('click', () => {
            if(sidebar) sidebar.classList.remove('open');
            toggleModal('modalPartnerInfo', 'open');
        });
    }
    if(document.getElementById('partnerInfoClose')) {
        document.getElementById('partnerInfoClose').addEventListener('click', () => {
            toggleModal('modalPartnerInfo', 'close');
        });
    }

    // --- EXÉCUTION DÉPÔTS ---
    if(document.getElementById('sbDepositBtn')) {
        document.getElementById('sbDepositBtn').addEventListener('click', () => { 
            if(sidebar) sidebar.classList.remove('open'); 
            toggleModal('modalDepositChoice', 'open'); 
        });
    }
    if(document.getElementById('depChoiceClose')) {
        document.getElementById('depChoiceClose').addEventListener('click', () => toggleModal('modalDepositChoice', 'close'));
    }
    if(document.getElementById('depChoiceCrypto')) {
        document.getElementById('depChoiceCrypto').addEventListener('click', () => { 
            toggleModal('modalDepositChoice', 'close'); 
            toggleModal('modalDepositCryptoForm', 'open'); 
        });
    }
    if(document.getElementById('cryptoDepBack')) {
        document.getElementById('cryptoDepBack').addEventListener('click', () => { 
            toggleModal('modalDepositCryptoForm', 'close'); 
            toggleModal('modalDepositChoice', 'open'); 
        });
    }
    if(document.getElementById('depChoiceMomo')) {
        document.getElementById('depChoiceMomo').addEventListener('click', () => {
            alert("Redirection vers la passerelle Fusion Money...");
        });
    }

    if(document.getElementById('cryptoDepSubmit')) {
        document.getElementById('cryptoDepSubmit').addEventListener('click', async () => {
            const amountInput = document.getElementById('cryptoDepAmount');
            const refInput = document.getElementById('cryptoDepRef');
            if(!amountInput || !refInput) return;

            const amount = parseInt(amountInput.value);
            const ref = refInput.value.trim();
            if(!amount || !ref) { alert("Veuillez remplir tous les champs."); return; }

            try {
                await addDoc(collection(db, "deposits"), {
                    userId: currentUserUid, amount: amount, reference: ref, channel: "Crypto", status: "En attente", createdAt: new Date()
                });
                alert("Reçu de dépôt transmis avec succès !");
                toggleModal('modalDepositCryptoForm', 'close');
                amountInput.value = ""; refInput.value = "";
            } catch(e) { alert("Erreur d'enregistrement."); }
        });
    }

    // --- COMPOSANT DES RETRAITS ---
    if(document.getElementById('sbWithdrawBtn')) {
        document.getElementById('sbWithdrawBtn').addEventListener('click', () => { 
            if(sidebar) sidebar.classList.remove('open'); 
            toggleModal('modalWithdrawChoice', 'open'); 
        });
    }
    if(document.getElementById('witChoiceClose')) {
        document.getElementById('witChoiceClose').addEventListener('click', () => toggleModal('modalWithdrawChoice', 'close'));
    }

    const openWithdrawalForm = (channelName) => {
        currentSelectedChannel = channelName;
        toggleModal('modalWithdrawChoice', 'close');
        toggleModal('modalWithdrawForm', 'open');
    };
    if(document.getElementById('witChoiceMomo')) document.getElementById('witChoiceMomo').addEventListener('click', () => openWithdrawalForm("Mobile Money"));
    if(document.getElementById('witChoiceCrypto')) document.getElementById('witChoiceCrypto').addEventListener('click', () => openWithdrawalForm("Crypto"));
    if(document.getElementById('witFormBack')) document.getElementById('witFormBack').addEventListener('click', () => { toggleModal('modalWithdrawForm', 'close'); toggleModal('modalWithdrawChoice', 'open'); });

    if(document.getElementById('witFormSubmit')) {
        document.getElementById('witFormSubmit').addEventListener('click', async () => {
            const amountInput = document.getElementById('witAmount');
            const recipientInput = document.getElementById('witRecipient');
            const pinInput = document.getElementById('witPin');
            if(!amountInput || !recipientInput || !pinInput) return;

            const amount = parseInt(amountInput.value);
            const recipient = recipientInput.value.trim();
            const pin = pinInput.value.trim();

            if(amount < 2050) { alert("Minimum requis pour le retrait : 2 050 FCFA"); return; }
            if(pin !== userTransactionPin) { alert("PIN de validation erroné."); return; }

            try {
                const userRef = doc(db, "users", currentUserUid);
                const snap = await getDoc(userRef);
                const bal = snap.data().balance || 0;

                if(bal < amount) { alert("Solde disponible insuffisant."); return; }

                await updateDoc(userRef, { balance: bal - amount });
                await addDoc(collection(db, "withdrawals"), {
                    userId: currentUserUid, amount: amount, destination: recipient, channel: currentSelectedChannel, status: "En attente", createdAt: new Date()
                });

                alert("Votre demande de retrait est prise en compte.");
                toggleModal('modalWithdrawForm', 'close');
                amountInput.value = ""; recipientInput.value = ""; pinInput.value = "";
                await refreshDashboardMetrics(currentUserUid);
            } catch(e) { alert("Une anomalie technique a suspendu le retrait."); }
        });
    }

    // --- SYSTÈME DE TRANSFERT DE FONDS ---
    if(document.getElementById('sbTransferBtn')) {
        document.getElementById('sbTransferBtn').addEventListener('click', () => { 
            if(sidebar) sidebar.classList.remove('open'); 
            toggleModal('modalTransferForm', 'open'); 
        });
    }
    if(document.getElementById('transClose')) document.getElementById('transClose').addEventListener('click', () => toggleModal('modalTransferForm', 'close'));

    if(document.getElementById('transSubmit')) {
        document.getElementById('transSubmit').addEventListener('click', async () => {
            const targetInput = document.getElementById('transTargetId');
            const amountInput = document.getElementById('transAmount');
            const pinInput = document.getElementById('transPin');
            if(!targetInput || !amountInput || !pinInput) return;

            const targetId = targetInput.value.trim();
            const amount = parseInt(amountInput.value);
            const pin = pinInput.value.trim();

            if(!targetId || !amount || pin !== userTransactionPin) { alert("Données invalides ou code PIN faux."); return; }
            if(targetId === currentUserUid) { alert("Interdiction de transférer des fonds à votre propre ID."); return; }

            try {
                const userRef = doc(db, "users", currentUserUid);
                const userSnap = await getDoc(userRef);
                const senderBalance = userSnap.data().balance || 0;

                if(senderBalance < amount) { alert("Problème : provisions insuffisantes."); return; }

                const targetRef = doc(db, "users", targetId);
                const targetSnap = await getDoc(targetRef);
                if(!targetSnap.exists()) { alert("L'ID indiqué n'existe pas."); return; }

                await updateDoc(userRef, { balance: senderBalance - amount });
                await updateDoc(targetRef, { balance: (targetSnap.data().balance || 0) + amount });

                alert("Le transfert a été exécuté instantanément !");
                toggleModal('modalTransferForm', 'close');
                targetInput.value = ""; amountInput.value = ""; pinInput.value = "";
                await refreshDashboardMetrics(currentUserUid);
            } catch(e) { alert("Le transfert a échoué."); }
        });
    }

    // --- COMMERCE DE ROBOTS EN LIGNE ---
    async function executePackPurchase(packName, price, dailyRevenue) {
        try {
            const userRef = doc(db, "users", currentUserUid);
            const userSnap = await getDoc(userRef);
            const currentBalance = userSnap.data().balance || 0;

            if (currentBalance < price) { alert("Erreur : Solde insuffisant."); return; }

            await updateDoc(userRef, {
                balance: currentBalance - price,
                activePacksCount: (userSnap.data().activePacksCount || 0) + 1,
                dailyProfit: (userSnap.data().dailyProfit || 0) + dailyRevenue
            });

            await addDoc(collection(db, "purchases"), {
                userId: currentUserUid, packName: packName, price: price, purchasedAt: new Date()
            });

            alert(`Félicitations, votre ${packName} est maintenant actif !`);
            await refreshDashboardMetrics(currentUserUid);
        } catch (err) { alert("Erreur lors de la tentative d'achat."); }
    }

    if(document.getElementById('buyViperBtn')) document.getElementById('buyViperBtn').addEventListener('click', () => executePackPurchase("Viper Bot", 2000, 100));
    if(document.getElementById('buyExtincteurBtn')) document.getElementById('buyExtincteurBtn').addEventListener('click', () => executePackPurchase("Extincteur Bot", 4000, 220));
    if(document.getElementById('buyCycloneBtn')) document.getElementById('buyCycloneBtn').addEventListener('click', () => executePackPurchase("Cyclone Bot", 10000, 600));

    // --- COMPTEUR CHRONOMÉTRIQUE GLOBAL ---
    function updateCountdown() {
        const now = new Date();
        const nextPayout = new Date();
        nextPayout.setHours(24, 0, 0, 0);

        const diff = nextPayout - now;

        if (diff <= 0) {
            if(document.getElementById('countdownTimer')) {
                document.getElementById('countdownTimer').innerText = "Distribution en cours...";
            }
            return;
        }

        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const formatH = hours < 10 ? "0" + hours : hours;
        const formatM = minutes < 10 ? "0" + minutes : minutes;
        const formatS = seconds < 10 ? "0" + seconds : seconds;

        if(document.getElementById('countdownTimer')) {
            document.getElementById('countdownTimer').innerText = `${formatH}h ${formatM}m ${formatS}s`;
        }
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
});
