import { useParams } from "react-router-dom";

const BRANCH_COACHES = {
  "branch-1": [
    { id: 1, name: "Ahmed Ali", specialty: "Fitness", status: "Active" },
    { id: 2, name: "Sara Mohamed", specialty: "Yoga", status: "Inactive" },
  ],
  "branch-2": [
    { id: 3, name: "Ali Hassan", specialty: "Cardio", status: "Active" },
  ],
  "branch-3": [
    { id: 4, name: "Mona Ali", specialty: "Zumba", status: "Inactive" },
  ],
};

export default function Coaches() {
  const { branchId } = useParams();
  const coaches = BRANCH_COACHES[branchId] || [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Coaches Management</h2>

      <div className="overflow-x-auto">
      <table className="w-full bg-white shadow rounded">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-2">Name</th>
            <th className="p-2">Specialty</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {coaches.map((coach) => (
            <tr key={coach.id} className="text-center border-t">
              <td className="p-2">{coach.name}</td>
              <td className="p-2">{coach.specialty}</td>
              <td className="p-2">{coach.status}</td>
              <td className="p-2">
                <button className="px-3 py-1 bg-blue-500 text-white rounded mr-2">
                  Edit
                </button>
                <button className="px-3 py-1 bg-red-500 text-white rounded">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
