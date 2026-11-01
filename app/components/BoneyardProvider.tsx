"use client";

import { configureBoneyard } from "boneyard-js/react";

configureBoneyard({
  animate: "shimmer",
  transition: 220,
  color: "#ECEAE3",
  shimmerColor: "#F3F0E9",
  darkColor: "#151719",
  darkShimmerColor: "#4C4C4C",
});

export default function BoneyardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
