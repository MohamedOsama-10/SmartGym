import { useParams } from "react-router-dom";

export default function BranchDashboard() {
  const { branchId } = useParams();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">
        Branch Dashboard: {branchId}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Coaches" value="5" />
        <StatCard title="Members" value="120" />
        <StatCard title="Active Subscriptions" value="90" />
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-white p-4 md:p-6 rounded shadow">
      <h3 className="text-gray-500">{title}</h3>
      <p className="text-2xl md:text-3xl font-bold">{value}</p>
    </div>
  );
}
