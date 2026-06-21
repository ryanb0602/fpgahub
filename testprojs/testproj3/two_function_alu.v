`timescale 1ns / 1ps

module two_function_alu (
    input  [3:0] a,
    input  [3:0] b,
    input        op_sel,  // 0 for Add, 1 for Subtract
    output [3:0] result,
    output       c_out
);

    wire [3:0] add_res, sub_res;
    wire       add_cout, sub_cout;

    // Branch 1
    add add_inst (
        .a(a),
        .b(b),
        .sum(add_res),
        .c_out(add_cout)
    );

    // Branch 2
    subtract sub_inst (
        .a(a),
        .b(b),
        .diff(sub_res),
        .c_out(sub_cout)
    );

    // Output Multiplexer
    assign result = op_sel ? sub_res  : add_res;
    assign c_out  = op_sel ? sub_cout : add_cout;

endmodule
