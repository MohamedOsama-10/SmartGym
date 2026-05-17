export default function Reports() {
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Gym Reports</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-bold">Total Users</h3>
          <p className="text-2xl text-blue-500">120</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-bold">Active Subscriptions</h3>
          <p className="text-2xl text-green-500">85</p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-bold">Total Coaches</h3>
          <p className="text-2xl text-purple-500">6</p>
        </div>
      </div>
    </div>
  );
}
