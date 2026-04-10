export interface PriceTier {
  quantity: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  tiers: PriceTier[];
}

export const products: Product[] = [
  {
    id: "a3",
    name: "A3",
    tiers: [
      { quantity: 1, price: 60 },
      { quantity: 3, price: 150 },
      { quantity: 10, price: 450 },
      { quantity: 30, price: 900 },
    ],
  },
  {
    id: "a4",
    name: "A4",
    tiers: [
      { quantity: 1, price: 40 },
      { quantity: 3, price: 100 },
      { quantity: 10, price: 300 },
      { quantity: 30, price: 600 },
    ],
  },
  {
    id: "mini-landscape",
    name: 'Mini Landscape (6"x12")',
    tiers: [
      { quantity: 1, price: 30 },
      { quantity: 4, price: 100 },
      { quantity: 10, price: 250 },
      { quantity: 20, price: 400 },
    ],
  },
  {
    id: "postcard",
    name: "Post Card",
    tiers: [
      { quantity: 1, price: 15 },
      { quantity: 4, price: 50 },
      { quantity: 10, price: 100 },
      { quantity: 23, price: 200 },
    ],
  },
  {
    id: "square-card",
    name: 'Square Card (3"x3")',
    tiers: [
      { quantity: 1, price: 8 },
      { quantity: 3, price: 20 },
      { quantity: 10, price: 60 },
      { quantity: 20, price: 100 },
    ],
  },
  {
    id: "mini-efootball",
    name: "Mini eFootball Card",
    tiers: [
      { quantity: 1, price: 5 },
      { quantity: 3, price: 10 },
      { quantity: 10, price: 30 },
      { quantity: 20, price: 50 },
    ],
  },
];

export function calculateCustomPrice(product: Product, quantity: number): number {
  if (quantity <= 0) return 0;

  const sortedTiers = [...product.tiers].sort((a, b) => b.quantity - a.quantity);
  let remaining = quantity;
  let total = 0;

  for (const tier of sortedTiers) {
    while (remaining >= tier.quantity) {
      total += tier.price;
      remaining -= tier.quantity;
    }
  }

  return total;
}
