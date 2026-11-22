export default { title: "Students" };

const firstNames = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Ananya", "Vihaan", "Isha", "Arjun", "Saanvi", "Dev", "Tara"];
const lastNames = ["Sharma", "Patel", "Iyer", "Reddy", "Khan", "Nair", "Gupta", "Das", "Verma", "Joshi", "Mehta", "Rao"];
const parentFirstNames = ["Sunil", "Priya", "Rakesh", "Neha", "Imran", "Lakshmi", "Anil", "Pooja", "Vikram", "Sneha", "Harish", "Rekha"];

// Sample data only. Deterministic by index.
export const students = [];
for (let i = 0; i < 12; i++) {
  students.push({
    id: `S${String(i + 1).padStart(3, "0")}`,
    name: `${firstNames[i]} ${lastNames[i]}`,
    parentName: `${parentFirstNames[i]} ${lastNames[i]}`,
    parentPhone: "90000000" + String(i + 1).padStart(2, "0"),
    monthlyFee: 1500 + ((i * 337) % 2501),
    dueDay: 1 + ((i * 5) % 21),
    sample: true,
  });
}
