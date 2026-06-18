`timescale 1ns / 1ps

module four_bit_full_adder (
    input  [3:0] a,
    input  [3:0] b,
    input        c_in,
    output [3:0] sum,
    output       c_out
);

    // Behavioral 4-bit addition
    assign {c_out, sum} = a + b + c_in;

endmodule
