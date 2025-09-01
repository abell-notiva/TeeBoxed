
import { getFacilityByHost } from '@/server/facilities';
import { redirect } from 'next/navigation';
import { BookingForm } from './booking-form';


async function getFacilityForBooking() {
    const facility = await getFacilityByHost();
    if (!facility) {
        return null;
    }
    
    return {
        id: facility.id,
        name: facility.name || '',
        slug: facility.slug || '',
    };
}


export default async function Page() {
    const facilityInfo = await getFacilityForBooking();

    if (!facilityInfo) {
        // If no facility is found from the subdomain, redirect to a search page.
        return redirect('/find-facility');
    }

    return <BookingForm facility={facilityInfo} />;
}
