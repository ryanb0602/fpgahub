`timescale 1ns / 1ps

module add (
    input  [3:0] a,
    input  [3:0] b,
    output [3:0] sum,
    output       c_out
);

    // Instantiates the shared full adder
    four_bit_full_adder fba_inst (
        .a(a),
        .b(b),
        .c_in(1'b0),
        .sum(sum),
        .c_out(c_out)
    );

endmodule
