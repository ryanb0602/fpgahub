`timescale 1ns / 1ps

module invert (
    input  [3:0] in,
    output [3:0] out
);

    // Bitwise inversion
    assign out = ~in;

endmodule
