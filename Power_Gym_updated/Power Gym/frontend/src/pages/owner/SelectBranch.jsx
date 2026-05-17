import { useNavigate } from "react-router-dom";

const branches = [
  { id: "branch-1", name: "Nasr City Branch" },
  { id: "branch-2", name: "Maadi Branch" },
  { id: "branch-3", name: "October Branch" },
];

export default function SelectBranch() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Choose Branch</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {branches.map(branch => (
          <div
            key={branch.id}
            onClick={() => navigate(`/owner/${branch.id}`)}
            className="cursor-pointer bg-white p-4 md:p-6 rounded shadow hover:shadow-lg transition"
          >
            <h2 className="text-xl font-semibold">{branch.name}</h2>
          </div>
        ))}
      </div>
    </div>
  );
}
