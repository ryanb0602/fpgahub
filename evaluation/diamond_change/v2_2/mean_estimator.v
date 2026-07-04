module mean_estimator #(
    parameter WIDTH     = 16,
    parameter ACC_W     = 40,
    parameter SHIFT_VAL = 4         // NEW: Parameter for power-of-2 division (window size)
)(
    input  wire                 clk,
    input  wire                 rst_n,
    input  wire                 sample_valid,
    input  wire                 window_reset,
    input  wire signed [WIDTH-1:0] sample_in,
    output wire signed [ACC_W-1:0] sum_out,
    output wire signed [ACC_W-1:0] mean_out,    // NEW: Shifted average output
    output wire                 ovf_err
);

    // MODIFIED: Added connectivity for the new .en() port
    dsp_mac_core #(
        .DATA_WIDTH(WIDTH),
        .ACC_WIDTH(ACC_W)
    ) u_mac_sum (
        .clk      (clk),
        .rst_n    (rst_n),
        .en       (sample_valid),   // NEW: Wired enable
        .clr_acc  (window_reset),
        .mult_a   (sample_in),
        .mult_b   (16'sd1),
        .acc_out  (sum_out),
        .overflow (ovf_err)
    );

    // NEW: Arithmetic right shift for mean approximation
    assign mean_out = sum_out >>> SHIFT_VAL;

endmodule
