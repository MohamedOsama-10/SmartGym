export default function Subscriptions() {
  const plans = [
    { id: 1, name: "Basic", price: "300 EGP", duration: "1 Month" },
    { id: 2, name: "Pro", price: "800 EGP", duration: "3 Months" },
    { id: 3, name: "Elite", price: "1500 EGP", duration: "6 Months" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Subscription Plans</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white p-4 rounded shadow">
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="text-gray-600">{plan.duration}</p>
            <p className="text-green-600 font-bold">{plan.price}</p>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-blue-500 text-white py-1 rounded">
                Edit
              </button>
              <button className="flex-1 bg-red-500 text-white py-1 rounded">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
