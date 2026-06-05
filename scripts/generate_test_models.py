import os
import sys

# Ensure models directory exists
models_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))
os.makedirs(models_dir, exist_ok=True)

try:
    import onnx
    from onnx import helper, TensorProto
except ImportError:
    print("[ERROR] 'onnx' library is not installed. Run 'pip install onnx' first.")
    sys.exit(1)

def create_dummy_model(output_shape, output_name, output_values, filename):
    # Inputs/outputs
    input_tensor = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, 224, 224])
    output_tensor = helper.make_tensor_value_info(output_name, TensorProto.FLOAT, output_shape)
    
    # Constant node to output our desired values
    tensor_val = helper.make_tensor(
        name='const_tensor',
        data_type=TensorProto.FLOAT,
        dims=output_shape,
        vals=output_values
    )
    
    node = helper.make_node(
        'Constant',
        inputs=[],
        outputs=[output_name],
        value=tensor_val
    )
    
    # Graph
    graph = helper.make_graph(
        [node],
        'dummy_graph',
        [input_tensor],
        [output_tensor]
    )
    
    # Model
    model = helper.make_model(graph, producer_name='dummy_producer')
    
    # Save
    dest_path = os.path.join(models_dir, filename)
    onnx.save(model, dest_path)
    print(f"Generated dummy model: {filename} ({os.path.getsize(dest_path)} bytes)")

if __name__ == "__main__":
    print("Generating CPU-based dummy ONNX models for testing...")
    
    # 1. Orientation model
    # Output shape: (1, 4), predicting 0 degrees rotation class
    create_dummy_model([1, 4], 'probs', [1.0, 0.0, 0.0, 0.0], 'orientation_efficientnetv2.onnx')
    
    # 2. DINOv2 model
    # Output shape: (1, 768), predicting constant visual embedding
    dinov2_vals = [0.036] * 768  # 0.036 * sqrt(768) ≈ 1.0 (L2 normalized)
    create_dummy_model([1, 768], 'embeddings', dinov2_vals, 'dinov2_small.onnx')
    
    # 3. CLIP aesthetic model
    # Output shape: (1, 1), predicting constant aesthetic score of 7.5
    create_dummy_model([1, 1], 'score', [7.5], 'clip_aesthetic.onnx')
    
    # 4. NIMA model
    # Output shape: (1, 10), predicting constant uniform quality distribution
    nima_vals = [0.1] * 10
    create_dummy_model([1, 10], 'probs', nima_vals, 'nima.onnx')
    
    print("All dummy ONNX models created successfully in models/ folder.")
