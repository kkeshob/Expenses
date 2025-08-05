import React, { useState, useEffect } from 'react';
import {
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonButton,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonInput,
} from '@ionic/react';
import { add, home, trash } from 'ionicons/icons';
import { db } from '../db';
import { toast } from 'react-toastify';
import Modal from 'react-modal';

// Expense group type
type ExpenseGroup = {
  id?: number;
  name: string;
  icon?: string;
};

interface SidebarProps {
  selectedGroupId: number | null;
  onSelectGroup: (id: number | null) => void;
  marginTop: number;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedGroupId, onSelectGroup, marginTop }) => {
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('home');
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);

  // Load groups from DB and restore selected group from localStorage
  useEffect(() => {
    const fetchGroups = async () => {
      const dbGroups = await db.accounts.toArray();
      setGroups(dbGroups);

      // Restore selected group from localStorage if available
      const storedGroupId = localStorage.getItem('selectedGroupId');
      if (storedGroupId && dbGroups.some(g => g.id === Number(storedGroupId))) {
        onSelectGroup(Number(storedGroupId));
      } else if (dbGroups.length > 0 && (selectedGroupId === null || !dbGroups.some(g => g.id === selectedGroupId))) {
        // If no group selected, select the first as default
        onSelectGroup(dbGroups[0].id!);
      }
    };
    fetchGroups();

    // Dexie hooks must be synchronous
    const syncFetchGroups = () => { fetchGroups(); };
    db.accounts.hook('creating', syncFetchGroups);
    db.accounts.hook('updating', syncFetchGroups);
    db.accounts.hook('deleting', syncFetchGroups);

    return () => {
      db.accounts.hook('creating').unsubscribe(syncFetchGroups);
      db.accounts.hook('updating').unsubscribe(syncFetchGroups);
      db.accounts.hook('deleting').unsubscribe(syncFetchGroups);
    };
    // eslint-disable-next-line
  }, []);

  // Save selected group to localStorage whenever it changes
  useEffect(() => {
    if (selectedGroupId !== null) {
      localStorage.setItem('selectedGroupId', String(selectedGroupId));
    }
  }, [selectedGroupId]);

  // Helper to get selected group object
  const selectedGroup = groups.find(g => g.id === selectedGroupId) || groups[0];

  // Add new group to DB
  const handleAddGroup = async () => {

    if (groups.some(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase())) {
      toast.error('Group with this name already exists');
      return;
    }
    if (newGroupName.trim() === '') {
      toast.error('Group name must not be blank');
      return;
    }
    try {
      const id = await db.accounts.add({
        name: newGroupName.trim(),
        icon: newGroupIcon || 'home',
      });
      setNewGroupName('');
      setNewGroupIcon('home');
      setGroups(await db.accounts.toArray());
      onSelectGroup(id);
      toast.success('Group added successfully');
    } catch (error) {
      toast.error('Failed to add group');
      console.error('Error adding group:', error);
    }
  };

  // Delete group
  const handleDeleteGroup = async (id: number) => {
    try {
      await db.accounts.delete(id);
      const updatedGroups = await db.accounts.toArray();
      setGroups(updatedGroups);
      if (selectedGroupId === id) {
        // Select another group if current is deleted
        const remaining = updatedGroups.filter(g => g.id !== id);
        if (remaining.length > 0) {
          onSelectGroup(remaining[0].id!);
        } else {
          onSelectGroup(null);
        }
      }
      toast.success('Group deleted');
    } catch {
      toast.error('Failed to delete group');
    }
    setDeletingGroupId(null);
  };
  const selectGrouop = (id: number) => {
    onSelectGroup(id);
    // Fetch transactions for the selected group and store in localStorage
    localStorage.setItem('selectedGroupId', String(id));

  };
  let MT = marginTop + 50;

  return (
    <>

      <IonContent>
        <IonItem
          style={{
            marginTop: 10,
            top:0,
            zIndex:995,
         position:'sticky',
            textAlign: 'center',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <IonInput
            type="text"
            value={newGroupName}
            placeholder="Group name"
            onIonChange={e => setNewGroupName((e as CustomEvent).detail.value!)}
            style={{
              marginBottom: 12,
              borderBottom: '1px solid #ccc',
              margin: '0 auto',
              flex: 4,
              padding: 10
            }}
            required

          />
          <IonButton
            expand="block"
            color="primary"
            type="button"
            onClick={() => {
              handleAddGroup();
            }}
            style={{
              marginTop: 18,
              width: 40,
              height: 40,
              borderRadius: 8,
              margin: '0 auto',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              minHeight: 0,
              padding: 0
            }}>
            <IonIcon icon={add} slot="icon-only" />
          </IonButton>
        </IonItem>
        <IonList >
          {groups.map(group => (
            <IonItem
              key={group.id}
              button
              onClick={() => selectGrouop(group.id!)} // This triggers setSelectedGroupId in parent
              color={selectedGroupId === group.id ? 'primary' : ''}
            >

              <IonLabel>{group.name}</IonLabel>
              <IonButton
                slot="end"
                color="danger"
                fill="clear"
                size="small"
                onClick={e => {
                  e.stopPropagation();
                  setDeletingGroupId(group.id!);
                }}
              >
                <IonIcon icon={trash} />
              </IonButton>
            </IonItem>
          ))}


        </IonList>
                    <div className='extraSpace'>
        
                    </div>
        
      </IonContent>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deletingGroupId}
        onRequestClose={() => setDeletingGroupId(null)}
        contentLabel="Delete Group"
        style={{
          overlay: {
            backgroundColor: 'rgba(25,118,210,0.13)',
            zIndex: 1200,
            backdropFilter: 'blur(3px)'
          },
          content: {
            maxWidth: 320,
            width: '90vw',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 8px 36px 0 rgba(25, 118, 210, 0.18)",
            padding: 0,
            border: 'none',
            minHeight: 0,
            overflow: 'visible'
          }
        }}
      >
        <div style={{ padding: 28, textAlign: 'center' }}>
          <h3 style={{ color: '#d32f2f', fontWeight: 700, marginBottom: 18 }}>
            Delete Group?
          </h3>
          <p>Are you sure you want to delete this group?</p>
          <IonButton
            expand="block"
            color="danger"
            onClick={() => handleDeleteGroup(deletingGroupId!)}
          >
            Delete
          </IonButton>
          <IonButton
            expand="block"
            color="light"
            onClick={() => setDeletingGroupId(null)}
          >
            Cancel
          </IonButton>


        </div>
      </Modal>
    </>
  );
};

export default Sidebar;