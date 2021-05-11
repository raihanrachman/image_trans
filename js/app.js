import * as THREE from 'three';
import fragment from "../shader/fragment.glsl";
import vertex from "../shader/vertex.glsl";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Scroll from "./scroll"
import imagesLoaded from "./imagesLoaded"
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import moon from '../img/gifa.jpeg';
export default class Sketch {
    constructor(options) {
        this.time = 0;
        this.container = options.dom;
        this.scene = new THREE.Scene();

        this.width = this.container.offsetWidth
        this.height = this.container.offsetHeight

        this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 100, 2000);
        this.camera.position.z = 600;

        this.camera.fov = 2 * Math.atan((this.height / 2) / 600) * (180 / Math.PI);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement)

        this.images = [...document.querySelectorAll('img')]



        const preload = new Promise(resolve => {
            imagesLoaded(document.querySelectorAll("img"), { background: true }, resolve())
        })

        let allDone = [preload]

        this.currentScroll = 0
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        Promise.all(allDone).then(() => {
            this.scroll = new Scroll()
            this.addImages()
            this.setPositions()

            this.mouseMovement()
            this.resize()
            this.setupResize()
            // this.addObjects();
            // window.addEventListener('scroll', () => {
            //     this.currentScroll = window.scrollY
            //     this.setPositions()
            // })
            this.composerPass()
            this.render();
        })

    }

    composerPass() {
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(this.renderPass);

        //custom shader pass
        var counter = 0.0;
        this.myEffect = {
            uniforms: {
                "tDiffuse": { value: null },
                "scrollSpeed": { value: null },
            },
            vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix 
              * modelViewMatrix 
              * vec4( position, 1.0 );
          }
          `,
            fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float scrollSpeed;
          varying vec2 vUv;

          
          void main(){
            vec2 newUV = vUv;
            float area = smoothstep(0.4, 0.,vUv.y);
            newUV.x -= (vUv.x - 0.5)*0.1*area*scrollSpeed;
            area = pow(area,4.);
            gl_FragColor = texture2D( tDiffuse, newUV);
            // gl_FragColor = vec4(area, 0.,0., 1.);
          }
          `
        }

        this.customPass = new ShaderPass(this.myEffect);
        this.customPass.renderToScreen = true;

        this.composer.addPass(this.customPass);
    }

    mouseMovement() {
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = (e.clientX / this.width) * 2 - 1;
            this.mouse.y = - (e.clientY / this.height) * 2 + 1;
            //translate mouse to uv value
            // update the picking ray with the camera and mouse position
            this.raycaster.setFromCamera(this.mouse, this.camera);

            // calculate objects intersecting the picking ray
            const intersects = this.raycaster.intersectObjects(this.scene.children);

            if (intersects.length > 0) {
                // console.log(intersects[0])
                let obj = intersects[0].object;
                obj.material.uniforms.hover.value = intersects[0].uv;
                // console.log(obj)
            }
        }, false)


    }

    addImages() {
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                uImage: { value: 0 },
                hover: { value: new THREE.Vector2(0.5, 0.5) },
                hoverState: { value: 0 },
                moonTexture: { value: new THREE.TextureLoader().load(moon) }
            },
            side: THREE.DoubleSide,
            fragmentShader: fragment,
            vertexShader: vertex,
            // wireframe: true
        })

        this.materials = []
        console.log(moon)

        this.imageStore = this.images.map(img => {
            let { top, left, width, height } = img.getBoundingClientRect()

            let geometry = new THREE.PlaneBufferGeometry(1, 1, 10, 10)
            let texture = new THREE.Texture(img);
            // let texture = new THREE.TextureLoader().load(img)
            texture.needsUpdate = true
            // let material = new THREE.MeshBasicMaterial({ map: texture })

            let material = this.material.clone()

            material.uniforms.uImage.value = texture

            this.materials.push(material)

            let mesh = new THREE.Mesh(geometry, material)
            mesh.scale.set(width, height, 1)

            this.scene.add(mesh)

            img.addEventListener('mouseenter', () => {
                gsap.to(material.uniforms.hoverState, {
                    duration: .4,
                    value: 1
                })
            })

            img.addEventListener('mouseout', () => {
                gsap.to(material.uniforms.hoverState, {
                    duration: .4,
                    value: 0
                })
            })

            return {
                img,
                mesh,
                top,
                left,
                width,
                height
            }
        })
    }

    setPositions() {
        this.imageStore.forEach(o => {
            let { top, left, height, mesh, width } = o
            mesh.position.y = this.currentScroll - top + this.height / 2 - height / 2
            mesh.position.x = left - this.width / 2 + width / 2
        })
    }

    resize() {
        this.width = this.container.offsetWidth
        this.height = this.container.offsetHeight
        this.renderer.setSize(this.width, this.height);
        this.camera.aspect = this.width / this.height
        this.images.forEach(img => {
            let { top, left, width, height } = img.getBoundingClientRect()
            this.imageStore.forEach(o => {
                if (o.img === img) {
                    o.img = img
                    o.top = top
                    o.left = left
                    o.width = width
                    o.height = height
                    o.mesh.scale.set(width, height, 1)

                }
            })


        })
        this.setPositions()

        this.camera.updateProjectionMatrix()
    }

    setupResize() {
        window.addEventListener('resize', this.resize.bind(this))
    }

    addObjects() {
        this.geometry = new THREE.PlaneBufferGeometry(200, 400, 10, 10);
        // this.geometry = new THREE.SphereBufferGeometry(.4, 40, 40);
        this.material = new THREE.MeshNormalMaterial();

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                moonTexture: { value: new THREE.TextureLoader().load(moon) }
            },
            side: THREE.DoubleSide,
            fragmentShader: fragment,
            vertexShader: vertex,
            wireframe: true
        })

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.mesh);
    }

    render() {
        this.time += 0.05;

        this.scroll.render()
        this.currentScroll = this.scroll.scrollToRender

        this.setPositions()
        this.customPass.uniforms.scrollSpeed.value = this.scroll.speedTarget
        //blob
        // this.mesh.rotation.x = this.time / 2000;
        // this.mesh.rotation.y = this.time / 1000;

        // this.material.uniforms.time.value = this.time;

        this.materials.forEach(m => {
            m.uniforms.time.value = this.time
        })

        //use this render while use postProcessing
        this.composer.render()

        //normal render
        // this.renderer.render(this.scene, this.camera);

        window.requestAnimationFrame(this.render.bind(this));
    }

}

new Sketch({ dom: document.getElementById('container') });

// let camera, scene, renderer;
// let geometry, material, mesh;

// init();

function init() {

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
    camera.position.z = 1;

    scene = new THREE.Scene();

    geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    material = new THREE.MeshNormalMaterial();

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animation);
    document.body.appendChild(renderer.domElement);

}

function animation(time) {



}