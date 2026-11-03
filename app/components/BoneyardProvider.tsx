"use client";

import { configureBoneyard } from "boneyard-js/react";

configureBoneyard({
  animate: "shimmer",
  transition: 220,
  color: "#e8edf8",
  shimmerColor: "#f7f9ff",
  darkColor: "#2b3559",
  darkShimmerColor: "#39456e",
});

export default function BoneyardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
