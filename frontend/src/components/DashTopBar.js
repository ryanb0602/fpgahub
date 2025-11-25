import React, { useEffect, useState } from "react";
import { Box, TextField, IconButton } from "@radix-ui/themes";
import { MagnifyingGlassIcon, PersonIcon } from "@radix-ui/react-icons";

export const DashTopBar = () => {
  return (
    <>
      <div
        style={{
          width: "100%",
          height: "8vh",
          background: "linear-gradient(to bottom, #3b1205, #1a0703)",
          borderBottom: "1px solid rgba(255, 124, 57, 0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between", // left + right spacing
          padding: "0 2rem",
          boxSizing: "border-box",
        }}
      >
        {/* LEFT */}
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <span style={{ color: "white" }}>Logo</span>
        </div>

        {/* CENTER */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <Box style={{ flex: 1, maxWidth: "35%" }}>
            <TextField.Root
              placeholder="Search for modules…"
              size="3"
              width="100%"
            >
              <TextField.Slot>
                <MagnifyingGlassIcon height="16" width="16" />
              </TextField.Slot>
            </TextField.Root>
          </Box>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton variant="ghost">
            <PersonIcon height={25} width={25} />
          </IconButton>
        </div>
      </div>
    </>
  );
};

export default DashTopBar;
