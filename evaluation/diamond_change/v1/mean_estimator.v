module mean_estimator #(
    parameter WIDTH = 16,
    parameter ACC_W = 40
)(
    input  wire                 clk,
    input  wire                 rst_n,
    input  wire                 sample_valid,
    input  wire                 window_reset,
    input  wire signed [WIDTH-1:0] sample_in,
    output wire signed [ACC_W-1:0] sum_out,
    output wire                 ovf_err
);

    // Instantiate MAC Core: mult_b is tied to constant 1 to perform simple accumulation
    dsp_mac_core #(
        .DATA_WIDTH(WIDTH),
        .ACC_WIDTH(ACC_W)
    ) u_mac_sum (
        .clk      (clk),
        .rst_n    (rst_n),
        .clr_acc  (window_reset),
        .mult_a   (sample_in),
        .mult_b   (16'sd1),
        .acc_out  (sum_out),
        .overflow (ovf_err)
    );

endmodule
