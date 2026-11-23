import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Configuration du projet Firebase Brigade 4
const firebaseConfig = {
  apiKey: "AIzaSyCiOwgE5pjluiFLIwUhJOvHefMG0RO5wic",
  authDomain: "gestionnaire-brigade-4-7dced.firebaseapp.com",
  projectId: "gestionnaire-brigade-4-7dced",
  storageBucket: "gestionnaire-brigade-4-7dced.firebasestorage.app",
  messagingSenderId: "691196715158",
  appId: "1:691196715158:web:429614f0e3221739fce2b7"
};
const ADMIN_UID = "RkaGapmTtiSdUOfO61DMNBMOs4q2";
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
let cachedMembers = [];
const money = n => new Intl.NumberFormat('fr-FR').format(Number(n)||0) + ' FCFA';
const dateNow = new Date();
$('today').textContent = dateNow.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
$('expenseDate').value = dateNow.toISOString().slice(0,10);

function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function showAuth(msg=''){ $('authView').classList.remove('hidden');$('appView').classList.add('hidden');$('logoutBtn').classList.add('hidden');$('authMessage').textContent=msg; }
function showApp(user){$('authView').classList.add('hidden');$('appView').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');const admin=user.uid===ADMIN_UID;$('userRole').textContent=admin?'Administrateur connecté':'Membre — consultation uniquement';document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!admin));}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('authMessage').textContent='Connexion…';try{await signInWithEmailAndPassword(auth,$('email').value.trim(),$('password').value);$('password').value='';}catch(err){$('authMessage').textContent='Connexion impossible. Vérifiez votre adresse e-mail et votre mot de passe.';console.error(err)}});
$('logoutBtn').addEventListener('click',()=>signOut(auth));
document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===btn));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('hidden',p.id!==btn.dataset.tab));}));

async function listDocs(name){const snap=await getDocs(query(collection(db,name),orderBy('createdAt','desc'))).catch(async()=>await getDocs(collection(db,name)));return snap.docs.map(d=>({id:d.id,...d.data()}));}
function record(title,sub,right){const el=document.createElement('div');el.className='record';const a=document.createElement('div'),b=document.createElement('div');a.textContent=title;const sm=document.createElement('small');sm.textContent=sub||'';a.append(sm);b.className='amount';b.textContent=right||'';el.append(a,b);return el}
async function editMember(member) {
  const nom = prompt("Nouveau nom :", member.nom || "");
  if (nom === null || !nom.trim()) return;

  const telephone = prompt("Nouveau téléphone :", member.telephone || "");
  if (telephone === null) return;

  try {
    await updateDoc(doc(db, "membres", member.id), {
      nom: nom.trim(),
      telephone: telephone.trim()
    });
    toast("Membre modifié avec succès.");
    await refresh();
  } catch (err) {
    console.error(err);
    toast("Erreur lors de la modification.");
  }
}
async function removeMember(member) {
  if (!confirm("Supprimer " + member.nom + " ? Les anciennes cotisations seront conservées.")) return;

  try {
    await deleteDoc(doc(db, "membres", member.id));
    toast("Membre supprimé.");
    await refresh();
  } catch (err) {
    console.error(err);
    toast("Erreur lors de la suppression.");
  }
}
async function refresh(){
  try {
    const [members, contribs, expenses] = await Promise.all([
      listDocs('membres'),
      listDocs('cotisations'),
      listDocs('depenses')
    ]);

    cachedMembers = members;

    const totalC = contribs.reduce((s,x) => s + (Number(x.montant)||0), 0);
    const totalE = expenses.reduce((s,x) => s + (Number(x.montant)||0), 0);

    $('balance').textContent = money(totalC-totalE);
    $('contributions').textContent = money(totalC);
    $('expenses').textContent = money(totalE);
    $('memberCount').textContent = members.length;

    renderMembers();

    const fill = (id, items, mapper, empty) => {
      const box = $(id);
      box.replaceChildren();
      if (!items.length) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = empty;
        box.append(p);
      } else {
        items.forEach(x => box.append(mapper(x)));
      }
    };

    fill('contributionList', contribs,
      x => record(x.membre || 'Membre', x.motif || 'Cotisation', money(x.montant)),
      'Aucune cotisation enregistrée.'
    );

    fill('expenseList', expenses,
      x => record(x.designation || 'Dépense', x.date || '', money(x.montant)),
      'Aucune dépense enregistrée.'
    );

  } catch(err) {
    console.error(err);
    toast('Lecture impossible : vérifiez les règles Firestore.');
  }
}
function renderMembers() {
  const term = ($('memberSearch').value || '').trim().toLowerCase();

  const filtered = cachedMembers.filter(x =>
    (x.nom || '').toLowerCase().includes(term) ||
    (x.telephone || '').toLowerCase().includes(term)
  );

  const box = $('memberList');
  box.replaceChildren();

  if (!filtered.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = term ? 'Aucun membre trouvé.' : 'Aucun membre enregistré.';
    box.append(p);
    return;
  }

  filtered.forEach(x => {
    const el = record(x.nom || 'Membre', x.telephone || 'Membre Brigade 4', '');

    if (auth.currentUser && auth.currentUser.uid === ADMIN_UID) {
      const actions = document.createElement('div');
      actions.className = 'member-actions';

      const edit = document.createElement('button');
      edit.textContent = 'Modifier';
      edit.onclick = () => editMember(x);

      const del = document.createElement('button');
      del.textContent = 'Supprimer';
      del.onclick = () => removeMember(x);

      actions.append(edit, del);
      el.append(actions);
    }

    box.append(el);
  });
}
async function save(collectionName,data){try{await addDoc(collection(db,collectionName),{...data,createdAt:serverTimestamp()});toast('Enregistrement effectué.');await refresh()}catch(err){console.error(err);toast('Enregistrement refusé. Vérifiez les droits administrateur.')}}
$('memberForm').addEventListener('submit',async e=>{e.preventDefault();await save('membres',{nom:$('memberName').value.trim(),telephone:$('memberPhone').value.trim()});e.target.reset()});
$('contributionForm').addEventListener('submit',async e=>{e.preventDefault();await save('cotisations',{membre:$('contributionMember').value.trim(),montant:Number($('contributionAmount').value),motif:$('contributionReason').value.trim()});e.target.reset()});
$('expenseForm').addEventListener('submit',async e=>{e.preventDefault();await save('depenses',{designation:$('expenseLabel').value.trim(),montant:Number($('expenseAmount').value),date:$('expenseDate').value});e.target.reset();$('expenseDate').value=dateNow.toISOString().slice(0,10)});
$('memberSearch').addEventListener('input', renderMembers);

onAuthStateChanged(auth,async user=>{if(user){showApp(user);await refresh()}else showAuth()});
