`timescale 1ns / 1ps

module subtract (
    input  [3:0] a,
    input  [3:0] b,
    output [3:0] diff,
    output       c_out
);

    wire [3:0] b_inv;

    // 1st step of 2's complement: Invert B
    invert inv_inst (
        .in(b),
        .out(b_inv)
    );

    // 2nd step of 2's complement: Add 1 via c_in
    four_bit_full_adder fba_inst (
        .a(a),
        .b(b_inv),
        .c_in(1'b1), 
        .sum(diff),
        .c_out(c_out)
    );

endmodule
