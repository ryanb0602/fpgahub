module dsp_mac_core #(
    parameter DATA_WIDTH = 16,
    parameter ACC_WIDTH  = 40
)(
    input  wire                  clk,
    input  wire                  rst_n,
    input  wire                  clr_acc,
    input  wire signed [DATA_WIDTH-1:0] mult_a,
    input  wire signed [DATA_WIDTH-1:0] mult_b,
    output reg  signed [ACC_WIDTH-1:0]  acc_out,
    output reg                   overflow
);

    wire signed [2*DATA_WIDTH-1:0] product;
    wire signed [ACC_WIDTH-1:0]    next_acc;

    assign product = mult_a * mult_b;
    assign next_acc = acc_out + {{ (ACC_WIDTH - 2*DATA_WIDTH){product[2*DATA_WIDTH-1]} }, product};

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            acc_out  <= {ACC_WIDTH{1'b0}};
            overflow <= 1'b0;
        end else if (clr_acc) begin
            acc_out  <= {{ (ACC_WIDTH - 2*DATA_WIDTH){product[2*DATA_WIDTH-1]} }, product};
            overflow <= 1'b0;
        end else begin
            acc_out <= next_acc;
            // Simple sign-bit mismatch overflow check
            if ((acc_out[ACC_WIDTH-1] == product[2*DATA_WIDTH-1]) && 
                (next_acc[ACC_WIDTH-1] != acc_out[ACC_WIDTH-1])) begin
                overflow <= 1'b1;
            end
        end
    end

endmodule
