import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase/firebaseConfig';

/**
 * Debug utility to check darkroom state
 */
export const debugDarkroom = async (userId) => {
  try {
    console.log('=== DEBUG: Darkroom Status ===');
    console.log('User ID:', userId);

    // Get darkroom document
    const darkroomRef = doc(db, 'darkrooms', userId);
    const darkroomDoc = await getDoc(darkroomRef);

    if (!darkroomDoc.exists()) {
      console.log('❌ No darkroom document found');
      return;
    }

    const darkroomData = darkroomDoc.data();
    console.log('\nDarkroom Data:', {
      nextRevealAt: darkroomData.nextRevealAt,
      lastRevealedAt: darkroomData.lastRevealedAt,
      createdAt: darkroomData.createdAt,
    });

    // Convert timestamps to dates for easier reading
    const now = new Date();
    const nextRevealDate = darkroomData.nextRevealAt?.toDate();
    const lastRevealedDate = darkroomData.lastRevealedAt?.toDate();

    console.log('\nTimestamps (human readable):');
    console.log('Current time:', now.toLocaleString());
    console.log('Next reveal at:', nextRevealDate?.toLocaleString() || 'N/A');
    console.log('Last revealed at:', lastRevealedDate?.toLocaleString() || 'N/A');

    // Check if ready to reveal
    const isReady = darkroomData.nextRevealAt?.seconds <= (now.getTime() / 1000);
    console.log('\nReady to reveal?', isReady);

    if (!isReady && nextRevealDate) {
      const timeUntilReveal = nextRevealDate - now;
      const minutesUntilReveal = Math.floor(timeUntilReveal / 1000 / 60);
      console.log(`Time until reveal: ${minutesUntilReveal} minutes`);
    }

    // Get developing photos
    const developingQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'developing')
    );

    const developingSnapshot = await getDocs(developingQuery);
    console.log(`\nDeveloping photos: ${developingSnapshot.size}`);

    developingSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log('  Photo:', {
        id: doc.id,
        capturedAt: data.capturedAt?.toDate().toLocaleString(),
        status: data.status,
      });
    });

    // Get revealed photos
    const revealedQuery = query(
      collection(db, 'photos'),
      where('userId', '==', userId),
      where('status', '==', 'revealed')
    );

    const revealedSnapshot = await getDocs(revealedQuery);
    console.log(`\nRevealed photos: ${revealedSnapshot.size}`);

    revealedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log('  Photo:', {
        id: doc.id,
        capturedAt: data.capturedAt?.toDate().toLocaleString(),
        revealedAt: data.revealedAt?.toDate().toLocaleString(),
        status: data.status,
      });
    });

    console.log('=== END DEBUG ===');

    return {
      darkroomExists: true,
      isReady,
      developingCount: developingSnapshot.size,
      revealedCount: revealedSnapshot.size,
      nextRevealAt: nextRevealDate,
    };
  } catch (error) {
    console.error('Error debugging darkroom:', error);
    return null;
  }
};
