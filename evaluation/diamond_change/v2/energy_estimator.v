module energy_estimator #(
    parameter WIDTH = 16,
    parameter ACC_W = 40
)(
    input  wire                 clk,
    input  wire                 rst_n,
    input  wire                 sample_valid,
    input  wire                 window_reset,
    input  wire signed [WIDTH-1:0] sample_in,
    output wire signed [ACC_W-1:0] energy_out,
    output wire                 ovf_err
);

    // Instantiate MAC Core: mult_a and mult_b are tied to sample_in to square the signal
    dsp_mac_core #(
        .DATA_WIDTH(WIDTH),
        .ACC_WIDTH(ACC_W)
    ) u_mac_sqr (
        .clk      (clk),
        .rst_n    (rst_n),
        .clr_acc  (window_reset),
        .mult_a   (sample_in),
        .mult_b   (sample_in),
        .acc_out  (energy_out),
        .overflow (ovf_err)
    );

endmodule
