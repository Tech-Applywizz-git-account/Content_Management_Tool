export interface Festival {
    name: string;
    day: number;
    month: number; // 0-indexed: 0 = Jan, 2 = Mar
}

export const FESTIVALS: Festival[] = [
    { name: "New Year's Day", day: 1, month: 0 },
    { name: "Lohri", day: 13, month: 0 },
    { name: "Makar Sankranti / Pongal", day: 14, month: 0 },
    { name: "Republic Day", day: 26, month: 0 },
    { name: "Holi", day: 4, month: 2 },
    { name: "International Women's Day", day: 8, month: 2 },
    { name: "Ugadi", day: 19, month: 2 },
    { name: "Eid-ul-Fitr", day: 21, month: 2 },
    { name: "Good Friday", day: 3, month: 3 },
    { name: "Labour Day", day: 1, month: 4 },
    { name: "Bakrid", day: 27, month: 4 },
    { name: "National Doctors' Day", day: 1, month: 6 },
    { name: "Friendship Day", day: 2, month: 7 },
    { name: "Independence Day", day: 15, month: 7 },
    { name: "Raksha Bandhan", day: 28, month: 7 },
    { name: "Teachers' Day", day: 5, month: 8 },
    { name: "Ganesh Chaturthi", day: 14, month: 8 },
    { name: "National Engineers' Day", day: 15, month: 8 },
    { name: "Gandhi Jayanti (National Holiday)", day: 2, month: 9 },
    { name: "Dussehra", day: 20, month: 9 },
    { name: "Diwali", day: 8, month: 10 },
    { name: "Children's Day", day: 14, month: 10 },
    { name: "Christmas Day", day: 25, month: 11 },
];

export const getUpcomingFestivals = (currentDate: Date = new Date()): (Festival & { daysLeft: number })[] => {
    const currentYear = currentDate.getFullYear();
    // Reset current date to midnight for accurate day calculation
    const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

    return FESTIVALS.map(festival => {
        let festivalDate = new Date(currentYear, festival.month, festival.day);

        // Calculate difference in days
        const diffTime = festivalDate.getTime() - today.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return { ...festival, daysLeft: diffDays };
    }).filter(festival => festival.daysLeft >= 0 && festival.daysLeft <= 10);
};
