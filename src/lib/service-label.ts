/** One service row, including a combo such as "Haircut + face wash". */
export function serviceChoiceLabel(service: { name: string; priceInr: number }) {
  const price = `₹${service.priceInr.toLocaleString("en-IN")}`;
  return `${service.name} · ${price}`;
}
